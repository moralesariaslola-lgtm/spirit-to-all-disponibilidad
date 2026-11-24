const SUPABASE_URL='https://lwummmobfscjlfzwvipz.supabase.co/';
const SUPABASE_KEY='sb_publishable_mOFOS8xe8TYF_6xCT8PiOQ_Xb516aNo';
const URL_ACCESO='https://moralesariaslola-lgtm.github.io/spirit-to-all-disponibilidad/';
let recuperandoPassword=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
const supabaseClient=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,experimental:{passkey:true}}});
let usuarioActual=null,perfilActual=null,eventosActuales=[],eventoActual=null,respuestasUsuario=new Map(),pestanaActual='enCurso',eventosPendientesIds=new Set();
let usuariosGestion=[],solicitudesGestion=[],pestanaUsuariosActual='pendientes',notificacionesGestion=new Map(),solistasGestion=new Map(),instrumentosGestion=new Map(),accesosGestion=new Map();
let direccionGestion=null;
let fechasEventoActual=[],respuestasFechasUsuario=new Map(),fechaGestorSeleccionada=null,contadorFechaCreacion=0;
let vapidPublicKeyCache=null;
// Avisos push de tareas: los destinatarios se eligen por ID, nunca por coincidencia aproximada de nombres.
let staTaskUsuarios=[],staTaskUsuariosCargados=false,staTaskUsuariosPromesa=null;
async function staCargarUsuariosParaTareas(){
  if(staTaskUsuariosCargados)return;
  if(staTaskUsuariosPromesa)return staTaskUsuariosPromesa;
  staTaskUsuariosPromesa=(async()=>{
    const {data,error}=await supabaseClient.rpc('sta_usuarios_asignables');
    if(error)throw error;
    staTaskUsuarios=(data||[]).map(u=>({id:String(u.usuario_id),nombre:String(u.nombre||'')}));
    staTaskUsuariosCargados=true;
  })();
  try{await staTaskUsuariosPromesa;}catch(err){console.warn('No se pudo cargar la lista de responsables:',err);}finally{staTaskUsuariosPromesa=null;}
}
function staTaskSelectorUsuario(id,asignado){
  return `<label class="control-label full">🔔 Responsable de esta tarea ${staPersonaPicker(id,asignado||'', 'tarea','')}<small class="muted">Busca por nombre (mínimo 2 letras). Se enviará aviso push a quien elijas si tiene las notificaciones activadas. Una tarea puede tener un responsable diferente al coordinador del área.</small></label>`;
}
// Coordinadores: solo gestores y administradores. Mantiene nombres históricos aunque no estén en la app.
function staCrmSelectorResponsable(id,actual,area=''){
  return staPersonaPicker(id,actual||'','coordinacion',area);
}
function staTaskResponsableDatos(selectId,textId){
  const usuarioId=document.getElementById(selectId)?.value||null;
  const nombre=staTaskUsuarios.find(u=>u.id===usuarioId)?.nombre;
  return {responsable_usuario_id:usuarioId, responsable:(nombre||document.getElementById(textId)?.value.trim()||'')||null};
}
async function staTaskAvisarAsignacion(origen,tareaId){
  try{
    const {data,error}=await supabaseClient.functions.invoke('avisos-tareas',{body:{tipo:'asignacion',origen,tarea_id:Number(tareaId)}});
    if(error||!data?.ok)console.warn('Tarea guardada; el aviso push no se pudo enviar:',error||data?.error);
  }catch(error){console.warn('Tarea guardada; el aviso push no se pudo enviar:',error);}
}

let todasFechasEventos=[],mesCalendario=new Date(new Date().getFullYear(),new Date().getMonth(),1),eventoWhatsappId=null,enlacesCochesCache=new Map();
let whatsappBolosDisponibles=[],whatsappSeleccion=null,whatsappCargaEnCurso=false;
let ensayosActuales=[],respuestasEnsayosUsuario=new Map(),fechaCalendarioActiva=null,contadorFechaEdicion=0,limiteHistorial=20;
let staInfoTecnicaPublicaCache=new Map(),staVestuarioPublicoCache=new Map();
let origenDetalleEvento='encuestas';
const CUERDAS=[{id:1,nombre:'Soprano 1'},{id:2,nombre:'Soprano 2'},{id:3,nombre:'Alto 1'},{id:4,nombre:'Alto 2'},{id:5,nombre:'Tenores'},{id:6,nombre:'Bajos'},{id:7,nombre:'Banda'}];
function esGestor(){return perfilActual&&perfilActual.aprobado===true&&['admin','gestor'].includes(perfilActual.rol)}
function esValidador(){return perfilActual&&perfilActual.aprobado===true&&['admin','validador'].includes(perfilActual.rol)}
function esAdmin(){return perfilActual&&perfilActual.aprobado===true&&perfilActual.rol==='admin'}
function ocultarPantallasAuth(){['login','crearCuenta','recuperarPassword','nuevaPassword'].forEach(id=>document.getElementById(id)?.classList.add('hidden'))}
function volverLogin(){ocultarPantallasAuth();document.getElementById('login')?.classList.remove('hidden')}
function abrirCrearCuenta(){ocultarPantallasAuth();document.getElementById('crearCuenta')?.classList.remove('hidden');document.getElementById('registroMensaje').textContent=''}
function abrirRecuperarPassword(){ocultarPantallasAuth();const e=document.getElementById('email')?.value?.trim();if(e)document.getElementById('recuperarEmail').value=e;document.getElementById('recuperarPassword')?.classList.remove('hidden');document.getElementById('recuperarMensaje').textContent=''}
function alternarPassword(id,boton){const input=document.getElementById(id);if(!input)return;input.type=input.type==='password'?'text':'password';if(boton)boton.textContent=input.type==='password'?'👁️':'🙈'}
function staLlaveDisponible(){return !!(window.isSecureContext&&window.PublicKeyCredential&&supabaseClient.auth.signInWithPasskey)}
function staMensajeErrorLlave(error){
  if(error?.code==='passkey_disabled')return 'Las llaves de acceso aún no están activadas en Spirit. Usa Google o tu contraseña por ahora.';
  if(error?.code==='webauthn_credential_exists')return 'Esta llave ya está registrada en tu cuenta.';
  if(error?.code==='webauthn_credential_not_found')return 'No hay una llave registrada para Spirit en este dispositivo o gestor de contraseñas.';
  if(error?.name==='NotAllowedError'||error?.code==='ERROR_CEREMONY_ABORTED')return 'Se canceló la comprobación del dispositivo. Puedes volver a intentarlo.';
  return 'No se pudo usar la llave de acceso. Inténtalo otra vez o entra con Google o tu contraseña.';
}
async function staEntrarConLlave(){
  const mensaje=document.getElementById('loginMensaje'),boton=document.getElementById('btnEntrarLlave');
  if(!staLlaveDisponible()){mensaje.textContent='Este navegador no admite llaves de acceso. Usa Google o tu contraseña.';return}
  if(boton.disabled)return;
  boton.disabled=true;mensaje.textContent='Abriendo el desbloqueo del dispositivo…';
  try{
    const {error}=await supabaseClient.auth.signInWithPasskey();
    if(error)throw error;
    await comprobarUsuario();
  }catch(error){console.warn('Llave de acceso:',error?.code||error?.name);mensaje.textContent=staMensajeErrorLlave(error)}
  finally{boton.disabled=false}
}
async function staAbrirLlaves(){
  if(!usuarioActual||!perfilActual?.aprobado)return;
  const dialogo=document.getElementById('staDialogLlaves');
  dialogo.showModal();
  document.getElementById('staLlavesMensaje').textContent=staLlaveDisponible()?'Puedes registrar más de un dispositivo para conservar otra vía de entrada.':'Este navegador no admite llaves de acceso.';
  document.getElementById('staRegistrarLlave').disabled=!staLlaveDisponible();
  await staCargarLlaves();
}
async function staCargarLlaves(){
  const lista=document.getElementById('staListaLlaves');
  lista.textContent='Consultando tus llaves…';
  try{
    const {data,error}=await supabaseClient.auth.passkey.list();
    if(error)throw error;
    const llaves=Array.isArray(data)?data:(data?.passkeys||[]);
    lista.replaceChildren();
    if(!llaves.length){lista.textContent='Todavía no has registrado ninguna llave de acceso.';return}
    llaves.forEach((llave,i)=>{
      const fila=document.createElement('div');
      fila.style.cssText='padding:12px 0;border-top:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:10px';
      const nombre=document.createElement('span');nombre.textContent=llave.friendly_name||'Llave '+(i+1);
      const borrar=document.createElement('button');borrar.type='button';borrar.className='btn-light';borrar.textContent='Eliminar';
      borrar.setAttribute('aria-label','Eliminar '+nombre.textContent);
      borrar.onclick=async()=>{
        if(!confirm('¿Eliminar esta llave de acceso? Después no podrás entrar con ella.'))return;
        borrar.disabled=true;
        const {error}=await supabaseClient.auth.passkey.delete({passkeyId:llave.id});
        document.getElementById('staLlavesMensaje').textContent=error?'No se pudo eliminar la llave.':'Llave eliminada.';
        await staCargarLlaves();
      };
      fila.append(nombre,borrar);lista.append(fila);
    });
  }catch(error){
    console.warn('Lista de llaves:',error?.code||error?.name);
    lista.textContent=staMensajeErrorLlave(error);
    if(error?.code==='passkey_disabled')document.getElementById('staRegistrarLlave').disabled=true;
    document.getElementById('staLlavesMensaje').textContent='';
  }
}
async function staRegistrarLlave(){
  const boton=document.getElementById('staRegistrarLlave'),mensaje=document.getElementById('staLlavesMensaje');
  if(!staLlaveDisponible()||!usuarioActual||boton.disabled)return;
  boton.disabled=true;mensaje.textContent='Confirma el desbloqueo en tu dispositivo…';
  try{
    const {error}=await supabaseClient.auth.registerPasskey();
    if(error)throw error;
    mensaje.textContent='✅ Llave registrada. Ya puedes entrar con este método.';
    await staCargarLlaves();
  }catch(error){console.warn('Registro de llave:',error?.code||error?.name);mensaje.textContent=staMensajeErrorLlave(error)}
  finally{boton.disabled=false}
}
let staAvisosCoroCache=[];
// Eliminar y editar son acciones exclusivas de administración; editar no dispara avisos push.
let staAvisoVistaPreviaUrl=null;
async function staActualizarAvisosCoro(){
  if(!usuarioActual?.id||!perfilActual?.aprobado)return;
  const {data,error}=await supabaseClient.rpc('sta_listar_avisos_con_imagen');
  if(error){console.warn('No se pudieron consultar los mensajes:',error.code);return}
  staAvisosCoroCache=data||[];
  const n=staAvisosCoroCache.filter(a=>!a.leido).length;
  const badge=document.getElementById('staAvisosBadge');
  if(badge){badge.textContent=n?'· '+n+' nuevo'+(n===1?'':'s'):'';badge.classList.toggle('hidden',!n)}
}
function staAvisosCoroHtml(){
  if(!staAvisosCoroCache.length)return '<p class="muted">Todavía no hay mensajes publicados.</p>';
  return staAvisosCoroCache.map(a=>`<button type="button" class="btn-light btn-full" style="margin:0 0 10px;text-align:left;white-space:normal" onclick="staLeerAvisoCoro(${Number(a.id)})"><strong>${a.leido?'':'● '}${escapeHtml(a.titulo)}${a.imagen_path?' · 📷':''}</strong><br><small>${new Date(a.creado_en).toLocaleString('es-ES')}</small><br><span>${escapeHtml(a.contenido.slice(0,100))}${a.contenido.length>100?'…':''}</span></button>`).join('');
}
async function staAbrirAvisos(){
  await staActualizarAvisosCoro();
  abrirStaSheet('Mensajes de Spirit','<div class="sta-sheet-intro"><strong>Comunicados del coro</strong><p>Aquí quedan guardados los mensajes aunque no tengas las notificaciones activadas.</p></div><div id="staListaAvisosCoro">'+staAvisosCoroHtml()+'</div>');
}
async function staLeerAvisoCoro(id){
  const aviso=staAvisosCoroCache.find(a=>Number(a.id)===Number(id));
  if(!aviso)return;
  let imagen='';
  if(aviso.imagen_path){
    const {data,error}=await supabaseClient.storage.from('sta-avisos').createSignedUrl(aviso.imagen_path,3600);
    imagen=error?'<p class="muted">No se pudo cargar la imagen. Vuelve a abrir el aviso.</p>':`<a href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noopener" aria-label="Ampliar imagen del aviso"><img class="sta-aviso-imagen" src="${escapeHtml(data.signedUrl)}" alt="Imagen adjunta al aviso: ${escapeHtml(aviso.titulo)}" loading="lazy"></a>`;
  }
  let documento='';
  const adjunto=await supabaseClient.rpc('sta_documento_aviso',{p_aviso_id:Number(id)});
  if(adjunto.error){documento='<p class="muted">No se pudo consultar el documento adjunto.</p>'}
  else if(adjunto.data?.path){
    const link=await supabaseClient.storage.from('sta-avisos-documentos').createSignedUrl(adjunto.data.path,3600);
    documento=link.error?'<p class="muted">No se pudo abrir el documento. Vuelve a intentarlo.</p>':`<a class="sta-aviso-documento" href="${escapeHtml(link.data.signedUrl)}" target="_blank" rel="noopener noreferrer"><span>📄</span><span><strong>${escapeHtml(adjunto.data.nombre)}</strong><small>${adjunto.data.tipo==='application/pdf'?'Ver PDF':'Abrir o descargar documento'} · ${Math.max(1,Math.round(Number(adjunto.data.tamano||0)/1024))} KB</small></span><b>↗</b></a>`;
  }
  if(document.getElementById('staSheetBackdrop')?.classList.contains('hidden'))return;
  pushStaSheet(aviso.titulo,`<div class="sta-sheet-intro"><p>${new Date(aviso.creado_en).toLocaleString('es-ES')}</p><div style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:16px;line-height:1.55">${escapeHtml(aviso.contenido)}</div>${imagen}${documento}</div>${esAdmin()?`<div class="sta-aviso-admin-acciones"><button class="btn-light" type="button" onclick="staEditarAvisoCoro(${Number(aviso.id)})">Editar mensaje</button><button class="btn-no sta-aviso-eliminar" type="button" onclick="staEliminarAvisoCoro(${Number(aviso.id)})">Eliminar mensaje</button></div><div id="staAvisoEliminarEstado" role="status" class="muted"></div>`:''}`,'history');
  if(!aviso.leido){
    const {error}=await supabaseClient.rpc('sta_marcar_aviso_leido',{p_id:id});
    if(!error){aviso.leido=true;const n=staAvisosCoroCache.filter(a=>!a.leido).length;const badge=document.getElementById('staAvisosBadge');badge.textContent=n?'· '+n+' nuevo'+(n===1?'':'s'):'';badge.classList.toggle('hidden',!n)}
  }
}
function staEditarAvisoCoro(id){
  if(!esAdmin())return;
  const aviso=staAvisosCoroCache.find(a=>Number(a.id)===Number(id));if(!aviso)return;
  pushStaSheet('Editar mensaje',`<div class="sta-sheet-intro"><strong>Corregir el comunicado</strong><p>Se actualizará el texto en la app sin enviar otra notificación push. La imagen adjunta se conserva.</p></div><label class="control-label">Título<input id="staAvisoEditarTitulo" maxlength="80" value="${escapeHtml(aviso.titulo)}"></label><label class="control-label">Mensaje<textarea id="staAvisoEditarContenido" maxlength="1200" rows="7">${escapeHtml(aviso.contenido)}</textarea></label><button id="staAvisoEditarGuardar" class="btn-primary btn-full" type="button" onclick="staGuardarEdicionAviso(${Number(id)})">Guardar cambios sin push</button><p id="staAvisoEditarEstado" role="status" class="muted"></p>`,'history');
}
async function staGuardarEdicionAviso(id){
  if(!esAdmin())return;
  const titulo=document.getElementById('staAvisoEditarTitulo')?.value.trim()||'';
  const contenido=document.getElementById('staAvisoEditarContenido')?.value.trim()||'';
  const boton=document.getElementById('staAvisoEditarGuardar'),estado=document.getElementById('staAvisoEditarEstado');
  if(!boton||!estado)return;
  if(titulo.length<3||titulo.length>80||contenido.length<5||contenido.length>1200){estado.textContent='Escribe un título de 3 a 80 caracteres y un mensaje de 5 a 1200.';return}
  boton.disabled=true;estado.textContent='Guardando cambios…';
  const {error}=await supabaseClient.rpc('sta_editar_aviso_coro',{p_id:Number(id),p_titulo:titulo,p_contenido:contenido});
  if(error){estado.textContent='No se pudieron guardar los cambios. '+(error.message||'');boton.disabled=false;return}
  const aviso=staAvisosCoroCache.find(a=>Number(a.id)===Number(id));if(aviso)Object.assign(aviso,{titulo,contenido});
  await staActualizarAvisosCoro();
  volverStaSheet();
  volverStaSheet();
  const lista=document.getElementById('staListaAvisosCoro');if(lista)lista.innerHTML=staAvisosCoroHtml();
}
async function staEliminarAvisoCoro(id){
  if(!esAdmin())return;
  const aviso=staAvisosCoroCache.find(a=>Number(a.id)===Number(id));if(!aviso)return;
  if(!confirm(`¿Eliminar «${aviso.titulo}» de los avisos del coro? Dejará de aparecer para todos. Las alertas push ya enviadas no se pueden retirar del móvil.`))return;
  const boton=document.querySelector('.sta-aviso-eliminar'),estado=document.getElementById('staAvisoEliminarEstado');if(boton)boton.disabled=true;if(estado)estado.textContent='Eliminando mensaje…';
  const {error}=await supabaseClient.rpc('sta_eliminar_aviso_coro',{p_id:Number(id)});
  if(error){if(estado)estado.textContent='No se pudo eliminar: '+(error.message||'Vuelve a intentarlo.');if(boton)boton.disabled=false;return}
  await staActualizarAvisosCoro();volverStaSheet();const lista=document.getElementById('staListaAvisosCoro');if(lista)lista.innerHTML=staAvisosCoroHtml();
}
async function staAbrirRedactarAviso(){
  if(!esAdmin())return;
  if(staAvisoVistaPreviaUrl){URL.revokeObjectURL(staAvisoVistaPreviaUrl);staAvisoVistaPreviaUrl=null}
  abrirStaSheet('Nuevo mensaje',`<div class="sta-sheet-intro"><strong>Mensaje para todo Spirit</strong><p>Quedará en Mensajes para todos los miembros aprobados. Puedes elegir si también se envía una alerta al móvil. WhatsApp sigue disponible por separado.</p></div>
    <label class="control-label">Título<input id="staAvisoTitulo" maxlength="80" placeholder="Ej.: Nueva forma de entrar en Spirit"></label>
    <label class="control-label">Mensaje<textarea id="staAvisoContenido" maxlength="1200" rows="6" placeholder="Escribe un aviso claro y concreto"></textarea></label>
    <label class="control-label sta-aviso-adjunto">Imagen opcional (JPG, PNG o WebP, máximo 3 MB)<input id="staAvisoImagen" type="file" accept="image/jpeg,image/png,image/webp" onchange="staAvisoPrevisualizarImagen(this)"></label>
    <label class="control-label sta-aviso-adjunto">Documento opcional (PDF, Word o Excel, máximo 5 MB)<input id="staAvisoDocumento" type="file" accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onchange="staAvisoValidarDocumento(this)"></label><p class="muted">Un documento por aviso. El PDF se puede ver en el móvil; Word y Excel se abren con una aplicación compatible. Usa la carpeta Material para archivos que deban permanecer organizados.</p>
    <label class="sta-aviso-push-opcion"><input id="staAvisoEnviarPush" type="checkbox"><span><strong>Enviar también una notificación push</strong><small>Opcional. Si no lo marcas, el mensaje queda solo en la app y no interrumpe al coro.</small></span></label>
    <div id="staAvisoImagenVista" class="sta-aviso-vista hidden"></div>
    <div id="staAvisoAlcance" class="muted" role="status">Comprobando dispositivos…</div>
    <div id="staAvisoEstado" class="muted" role="status"></div>
    <button id="staAvisoPublicar" class="btn-primary btn-full" type="button" onclick="staPublicarAvisoCoro()">Publicar mensaje</button>`);
  try{
    const {data,error}=await supabaseClient.functions.invoke('avisos-coro',{body:{accion:'vista_previa'}});
    if(error||!data?.ok)throw error||new Error(data?.error);
    const alcance=document.getElementById('staAvisoAlcance');
    if(alcance)alcance.textContent=`Se publicará para ${data.usuarios} usuarios. Push posible: ${data.con_push} usuarios en ${data.dispositivos} dispositivos. La entrega final se comprobará al publicar.`;
  }catch(error){const alcance=document.getElementById('staAvisoAlcance');if(alcance)alcance.textContent='No se pudo consultar el alcance del push. El mensaje puede quedar publicado en la aplicación.'}
}
function staAvisoPrevisualizarImagen(input){
  const vista=document.getElementById('staAvisoImagenVista'),estado=document.getElementById('staAvisoEstado');
  if(staAvisoVistaPreviaUrl){URL.revokeObjectURL(staAvisoVistaPreviaUrl);staAvisoVistaPreviaUrl=null}
  const archivo=input.files?.[0];vista.replaceChildren();vista.classList.toggle('hidden',!archivo);
  if(!archivo)return;
  if(!['image/jpeg','image/png','image/webp'].includes(archivo.type)||archivo.size>3*1024*1024){input.value='';vista.classList.add('hidden');estado.textContent='Elige una imagen JPG, PNG o WebP de hasta 3 MB.';return}
  estado.textContent='';staAvisoVistaPreviaUrl=URL.createObjectURL(archivo);
  const imagen=document.createElement('img');imagen.src=staAvisoVistaPreviaUrl;imagen.alt='Vista previa de la imagen del aviso';vista.append(imagen);
}
function staAvisoValidarDocumento(input){
  const estado=document.getElementById('staAvisoEstado'),f=input.files?.[0];if(!f)return;
  const permitido={'application/pdf':'.pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'.xlsx'};
  if(!permitido[f.type]||!f.name.toLowerCase().endsWith(permitido[f.type])||f.size<1||f.size>5*1024*1024){input.value='';if(estado)estado.textContent='Elige un PDF, DOCX o XLSX de hasta 5 MB.';return}
  if(estado)estado.textContent=`Documento seleccionado: ${f.name} (${Math.round(f.size/1024)} KB).`;
}
async function staPublicarAvisoCoro(){
  if(!esAdmin())return;
  const titulo=document.getElementById('staAvisoTitulo')?.value.trim()||'';
  const contenido=document.getElementById('staAvisoContenido')?.value.trim()||'';
  const archivo=document.getElementById('staAvisoImagen')?.files?.[0]||null;
  const documento=document.getElementById('staAvisoDocumento')?.files?.[0]||null;
  const enviarPush=Boolean(document.getElementById('staAvisoEnviarPush')?.checked);
  const estado=document.getElementById('staAvisoEstado'),boton=document.getElementById('staAvisoPublicar');
  if(titulo.length<3||titulo.length>80||contenido.length<5||contenido.length>1200){estado.textContent='Escribe un título de 3 a 80 caracteres y un mensaje de 5 a 1200.';return}
  if(archivo&&(!['image/jpeg','image/png','image/webp'].includes(archivo.type)||archivo.size>3*1024*1024)){estado.textContent='La imagen debe ser JPG, PNG o WebP y ocupar menos de 3 MB.';return}
  const docTipos={'application/pdf':'.pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'.docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'.xlsx'};
  if(documento&&(!docTipos[documento.type]||!documento.name.toLowerCase().endsWith(docTipos[documento.type])||documento.size<1||documento.size>5*1024*1024)){estado.textContent='El documento debe ser PDF, DOCX o XLSX y ocupar hasta 5 MB.';return}
  if(!confirm(enviarPush?'¿Publicar este mensaje en Spirit y enviar una notificación push?':'¿Publicar este mensaje solo en Spirit, sin enviar push?'))return;
  boton.disabled=true;estado.textContent='Publicando el mensaje…';
  let imagenPath=null,documentoPath=null,publicado=false;
  try{
    if(archivo){
      imagenPath=`${usuarioActual.id}/${crypto.randomUUID()}.${({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' })[archivo.type]}`;
      estado.textContent='Subiendo la imagen…';
      const subida=await supabaseClient.storage.from('sta-avisos').upload(imagenPath,archivo,{contentType:archivo.type,upsert:false});
      if(subida.error)throw subida.error;
    }
    if(documento){
      documentoPath=`${usuarioActual.id}/${crypto.randomUUID()}${docTipos[documento.type]}`;
      estado.textContent='Subiendo el documento…';
      const subida=await supabaseClient.storage.from('sta-avisos-documentos').upload(documentoPath,documento,{contentType:documento.type,upsert:false});
      if(subida.error)throw subida.error;
    }
    const {data:id,error}=documento
      ?await supabaseClient.rpc('sta_publicar_aviso_documento',{p_titulo:titulo,p_contenido:contenido,p_imagen_path:imagenPath,p_enviar_push:enviarPush,p_doc_path:documentoPath,p_doc_nombre:documento.name.slice(0,150),p_doc_tipo:documento.type,p_doc_bytes:documento.size})
      :await supabaseClient.rpc('sta_publicar_aviso_opcional',{p_titulo:titulo,p_contenido:contenido,p_imagen_path:imagenPath,p_enviar_push:enviarPush});
    if(error)throw error;
    publicado=true;
    boton.textContent='Mensaje publicado';
    estado.textContent=enviarPush?'✅ Publicado en Spirit. Enviando push a los dispositivos activos…':`✅ Mensaje${documento?' con documento':''} publicado en Spirit sin enviar push.`;
    await staActualizarAvisosCoro();
    if(!enviarPush)return;
    try{
      const r=await supabaseClient.functions.invoke('avisos-coro',{body:{accion:'enviar',aviso_id:Number(id)}});
      if(r.error||!r.data?.ok)throw r.error||new Error(r.data?.error);
      estado.textContent=`✅ Mensaje${archivo?' con imagen':''} publicado. Push aceptados: ${r.data.enviados||0}; fallidos: ${r.data.fallidos||0}. ${r.data.usuarios-r.data.con_push} personas sin dispositivo registrado lo verán al entrar en la app.`;
    }catch(e){estado.textContent='✅ Mensaje publicado en Spirit. No se pudo confirmar el push; el aviso permanece en la app.'}
  }catch(error){
    if(!publicado&&imagenPath)await supabaseClient.storage.from('sta-avisos').remove([imagenPath]).catch(()=>{});
    if(!publicado&&documentoPath)await supabaseClient.storage.from('sta-avisos-documentos').remove([documentoPath]).catch(()=>{});
    estado.textContent='No se pudo publicar: '+(error.message||'Inténtalo de nuevo.');boton.disabled=false;
  }
  return;
}
let accesoEnCurso=false;
async function ejecutarAcceso(mensaje,operacion){
  if(accesoEnCurso)return;
  accesoEnCurso=true;
  const estado=document.getElementById('loginMensaje');
  const botones=document.querySelectorAll('#login button');
  botones.forEach(b=>b.disabled=true);
  estado.textContent=mensaje;
  try{
    await operacion(estado);
  }catch(error){
    console.warn('Acceso:',error?.code||error?.name);
    estado.textContent='No se ha podido completar el acceso. Inténtalo de nuevo en unos minutos.';
  }finally{
    botones.forEach(b=>b.disabled=false);
    accesoEnCurso=false;
  }
}
async function iniciarGoogle(){
  if(new URLSearchParams(location.search).get('manual')==='1')try{sessionStorage.setItem('sta_manual_after_login','1')}catch(_){}
  await ejecutarAcceso('Abriendo Google…',async estado=>{
    const{error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:URL_ACCESO}});
    if(error)estado.textContent='No se ha podido abrir Google. Puedes entrar con tu correo.';
  });
}
function leerCorreoAcceso(){
  const campo=document.getElementById('email');
  if(campo.value.trim()&&campo.validity.valid)return campo.value.trim().toLowerCase();
  document.getElementById('loginMensaje').textContent='Escribe un correo electrónico válido.';
  campo.focus();
  return '';
}
async function iniciarSesion(){
  const email=leerCorreoAcceso();
  if(!email)return;
  const campo=document.getElementById('password');
  const password=campo.value;
  if(!password){
    document.getElementById('loginMensaje').textContent='Escribe tu contraseña.';
    campo.focus();
    return;
  }
  await ejecutarAcceso('Entrando…',async estado=>{
    const{error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error){
      estado.textContent=error.code==='email_not_confirmed'
        ? 'Tu cuenta requiere revisión. Contacta con un administrador de Spirit to All.'
        : error.code==='invalid_credentials'
          ? 'Correo o contraseña incorrectos. Si has olvidado tu contraseña, puedes recuperarla.'
          : 'El acceso por contraseña no está disponible ahora. Inténtalo de nuevo en unos minutos.';
      return;
    }
    campo.value='';
    estado.textContent='';
    await comprobarUsuario();
  });
}
async function crearCuenta(){const nombre=document.getElementById('registroNombre').value.trim(),cuerda=Number(document.getElementById('registroCuerda').value),email=document.getElementById('registroEmail').value.trim().toLowerCase(),password=document.getElementById('registroPassword').value,password2=document.getElementById('registroPassword2').value,m=document.getElementById('registroMensaje'),b=document.getElementById('btnCrearCuenta');if(!nombre||!CUERDAS.some(c=>Number(c.id)===cuerda)||!email||!password||!password2){m.textContent='⚠️ Completa todos los campos.';return}if(!document.getElementById('registroEmail').validity.valid){m.textContent='Escribe un correo electrónico válido.';return}if(password.length<8){m.textContent='⚠️ La contraseña debe tener al menos 8 caracteres.';return}if(password!==password2){m.textContent='⚠️ Las contraseñas no coinciden.';return}b.disabled=true;m.textContent='Creando tu cuenta y enviando la solicitud…';try{const{data,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:URL_ACCESO,data:{full_name:nombre,cuerda_id:cuerda,registro_spirit:true}}});if(error)throw error;if(!data?.session){m.textContent='El registro está pendiente de revisión. Contacta con un administrador de Spirit to All.';return}if(!data?.user)throw new Error('No se recibió el perfil de registro.');usuarioActual=data.user;const{error:errorSolicitud}=await supabaseClient.rpc('solicitar_acceso',{p_nombre:nombre,p_cuerda_id:cuerda});if(errorSolicitud)throw errorSolicitud;ocultarPantallasAuth();document.getElementById('completarPerfil')?.classList.add('hidden');document.getElementById('accesoPendiente')?.classList.remove('hidden');document.getElementById('btnLogout')?.classList.remove('hidden');m.textContent='';mostrarSolicitudPendiente();}catch(error){console.error(error);const txt=String(error?.message||'').toLowerCase();if(txt.includes('already')||txt.includes('registered')){m.textContent='Este correo ya está registrado. Si no puedes acceder o tu cuenta fue desactivada, ponte en contacto con un administrador de Spirit to All. Si simplemente has olvidado la contraseña, utiliza «¿Has olvidado tu contraseña?».'}else{m.textContent='❌ No se ha podido crear la cuenta. Revisa los datos y vuelve a intentarlo.'}}finally{b.disabled=false}}
async function solicitarRecuperacionPassword(){const campo=document.getElementById('recuperarEmail'),email=campo.value.trim().toLowerCase(),m=document.getElementById('recuperarMensaje'),b=document.getElementById('btnRecuperarPassword');if(!email||!campo.validity.valid){m.textContent='⚠️ Escribe un correo electrónico válido.';return}b.disabled=true;m.textContent='Enviando enlace…';try{const{error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:URL_ACCESO});if(error)throw error;m.textContent='Si este correo tiene acceso con contraseña, recibirás un enlace para cambiarla. Revisa también spam. Si entras con Google, usa el botón «Entrar con Google».'}catch(error){console.warn('Recuperación:',error);m.textContent='No se pudo solicitar el enlace ahora. Prueba de nuevo en unos minutos o contacta con un administrador.'}finally{b.disabled=false}}
async function solicitarAccesoPorEnlace(){
  const campo=document.getElementById('recuperarEmail'),email=campo.value.trim().toLowerCase();
  const mensaje=document.getElementById('recuperarMensaje'),boton=document.getElementById('btnAccesoPorEnlace');
  if(!email||!campo.validity.valid){mensaje.textContent='⚠️ Escribe un correo electrónico válido.';campo.focus();return}
  boton.disabled=true;mensaje.textContent='Solicitando enlace de acceso…';
  try{
    const {error}=await supabaseClient.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:URL_ACCESO}});
    if(error)throw error;
    mensaje.textContent='Si el correo corresponde a una cuenta, recibirás un enlace para entrar sin contraseña. Revisa también spam. El enlace es temporal y solo se usa una vez.';
  }catch(error){
    console.warn('Acceso por enlace:',error?.code||error?.name);
    mensaje.textContent='No se pudo solicitar el enlace ahora. Espera unos minutos y vuelve a intentarlo.';
  }finally{boton.disabled=false}
}
async function guardarNuevaPassword(){const p1=document.getElementById('nuevaPassword1').value,p2=document.getElementById('nuevaPassword2').value,m=document.getElementById('nuevaPasswordMensaje');if(p1.length<8){m.textContent='⚠️ La contraseña debe tener al menos 8 caracteres.';return}if(p1!==p2){m.textContent='⚠️ Las contraseñas no coinciden.';return}m.textContent='Guardando…';const{error}=await supabaseClient.auth.updateUser({password:p1});if(error){console.error(error);m.textContent='❌ No se ha podido cambiar la contraseña.';return}recuperandoPassword=false;m.textContent='✅ Contraseña actualizada.';setTimeout(()=>{history.replaceState({},'',location.pathname);comprobarUsuario()},700)}
let saliendo=false;
async function cerrarSesion(){
  if(saliendo)return;
  saliendo=true;
  try{
    const{error}=await supabaseClient.auth.signOut({scope:'local'});
    if(error)throw error;
    location.replace(URL_ACCESO);
  }catch(error){
    console.warn('No se pudo cerrar la sesión:',error?.code);
    alert('No se ha podido cerrar la sesión. Inténtalo de nuevo.');
  }finally{saliendo=false}
}

function soportePushDisponible(){
  return ('Notification' in window) && ('serviceWorker' in navigator) && ('PushManager' in window);
}
function mensajeIOSNotificaciones(){
  if(!esIOS())return '';
  if(!estaEnModoApp()){
    return '📱 En iPhone, las notificaciones funcionan al abrir Spirit to All como app. Abre el menú del navegador o Compartir → Añadir a pantalla de inicio, abre después Spirit to All desde su nuevo icono y vuelve a activar las notificaciones.';
  }
  return '📱 Este iPhone no ofrece notificaciones push a la app en este momento. Comprueba que tenga iOS 16.4 o posterior y revisa Ajustes → Notificaciones → Spirit to All.';
}
async function solicitarAcceso(){
  const nombre=document.getElementById('nombrePerfil').value.trim();
  const cuerda=Number(document.getElementById('cuerdaPerfil').value);
  const mensaje=document.getElementById('mensajePerfil');
  const boton=document.getElementById('btnSolicitarAcceso');
  if(!nombre||!CUERDAS.some(c=>Number(c.id)===cuerda)){mensaje.textContent='⚠️ Indica tu nombre y tu cuerda.';return}
  if(boton)boton.disabled=true;
  mensaje.textContent='Enviando solicitud…';
  const{error}=await supabaseClient.rpc('solicitar_acceso',{p_nombre:nombre,p_cuerda_id:cuerda});
  if(error){
    console.error(error);mensaje.textContent='❌ No se ha podido enviar la solicitud.';if(boton)boton.disabled=false;return;
  }
  document.getElementById('completarPerfil').classList.add('hidden');
  document.getElementById('accesoPendiente').classList.remove('hidden');
  mostrarSolicitudPendiente();
}

function mostrarSolicitudPendiente(){
  supabaseClient.functions.invoke('enviar-notificaciones',{body:{tipo:'solicitud_acceso'}}).then(({data,error})=>{
    if(error||!data?.ok)console.warn('No se pudo avisar al administrador de la solicitud.',error||data?.error);
  }).catch(error=>console.warn('Aviso de nueva solicitud no enviado:',error));
  void prepararAvisosPendiente();
}
supabaseClient.auth.onAuthStateChange(event=>{
  if(event==='PASSWORD_RECOVERY')recuperandoPassword=true;
});
async function comprobarUsuario(){
  usuarioActual=null;
  perfilActual=null;
  document.body.classList.add('auth-pending');
  staCambiarHomeMenu('rapidos');
  ['homeTabGestion','homeUsuarios','homePublicarAviso','panelCalendario','panelWhatsapp'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  ['btnGestionEncuestas','btnPresupuestos','btnCalendario','btnMaterialCoro','btnWhatsapp','btnAdminUsuarios','btnInstalarApp','btnLogout'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  ['login','crearCuenta','recuperarPassword','nuevaPassword','completarPerfil','accesoPendiente','accesoEliminado','app','panelSolicitudes','panelUsuarios','panelGestor'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  const{data:{user},error}=await supabaseClient.auth.getUser();
  if(error||!user){document.getElementById('login').classList.remove('hidden');return}
  if(recuperandoPassword){
    document.getElementById('nuevaPassword').classList.remove('hidden');
    return;
  }
  usuarioActual=user;
  const{data:perfil,error:errorPerfil}=await supabaseClient.from('perfiles').select('nombre, cuerda_id, rol, aprobado, eliminado').eq('id',user.id).maybeSingle();
  if(errorPerfil){console.error(errorPerfil);document.getElementById('login').classList.remove('hidden');document.getElementById('loginMensaje').textContent='No se ha podido comprobar tu perfil.';return}
  if(!perfil){
    document.getElementById('nombrePerfil').value=user.user_metadata?.full_name||user.user_metadata?.name||'';
    if(user.user_metadata?.cuerda_id)document.getElementById('cuerdaPerfil').value=String(user.user_metadata.cuerda_id);
    document.getElementById('completarPerfil').classList.remove('hidden');return
  }
  if(perfil.eliminado===true){document.getElementById('accesoEliminado').classList.remove('hidden');return}
  if(!perfil.aprobado){
    if(!perfil.cuerda_id){document.getElementById('nombrePerfil').value=perfil.nombre||user.user_metadata?.full_name||user.user_metadata?.name||'';document.getElementById('completarPerfil').classList.remove('hidden');return}
    document.getElementById('accesoPendiente').classList.remove('hidden');prepararAvisosPendiente();return
  }
  perfilActual=perfil;
  document.body.classList.remove('auth-pending');
  document.getElementById('app').classList.remove('hidden');
  // Cargar la novedad al terminar de construir Inicio, sin esperar a usuarios o encuestas.
  const cargarAyudaInicio=()=>{if(usuarioActual?.id===user.id)void staColabActualizarInicio()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cargarAyudaInicio,{once:true});
  else cargarAyudaInicio();
  const avisoAcceso=document.getElementById('staAccesoAprobado');
  const clavePendiente='sta-acceso-pendiente:'+user.id;
  let mostrarAprobacion=new URLSearchParams(location.search).get('aprobado')==='1';
  try{
    mostrarAprobacion=mostrarAprobacion||localStorage.getItem(clavePendiente)==='1';
    localStorage.removeItem(clavePendiente);
  }catch(_){}
  avisoAcceso?.classList.toggle('hidden',!mostrarAprobacion);

  document.getElementById('saludoUsuario').textContent='Hola, '+perfil.nombre+' 👋';
  document.getElementById('btnLogout').classList.remove('hidden');
  document.getElementById('btnCalendario').classList.remove('hidden');
  document.getElementById('btnMaterialCoro').classList.remove('hidden');
  actualizarBotonInstalacion();
  void comprobarEstadoNotificaciones();
  await staCargarPermisosPropios();
  if(esGestor()){
    document.getElementById('btnGestionEncuestas').classList.toggle('hidden',!staTienePermiso('encuestas'));
    document.getElementById('btnPresupuestos').classList.toggle('hidden',!staTienePermiso('contabilidad'));
    document.getElementById('btnWhatsapp').classList.remove('hidden');
    staActualizarMenuPermisos();
    document.getElementById('homeTabGestion')?.classList.remove('hidden');
  }
  if(esAdmin()){document.getElementById('btnAdminUsuarios').classList.remove('hidden');document.getElementById('homeUsuarios')?.classList.remove('hidden');document.getElementById('homePublicarAviso')?.classList.remove('hidden');await cargarGestionUsuarios()}
  else if(esValidador()){document.getElementById('panelSolicitudes').classList.remove('hidden');await cargarSolicitudes()}
  cambiarPestana('enCurso');
  await cargarTodo();
  await staActualizarAvisosCoro();
  if(esGestor())await cargarEstadosNotificaciones();
  const params=new URLSearchParams(location.search);const q=params.get('evento');
  if(q&&eventosActuales.some(e=>String(e.id)===q))await seleccionarEvento(Number(q));
  if(params.get('admin')==='pendientes'&&esAdmin()){cambiarPestanaUsuarios('pendientes');abrirGestionUsuarios()}
  if(params.get('calendario')==='1'){const ensayoQ=Number(params.get('ensayo')||0);if(ensayoQ)abrirEnsayoCalendario(ensayoQ);else abrirCalendario()}
  if(params.get('comunicados')==='1')await staAbrirAvisos();
  if(params.get('ayuda')==='1')await staColabAbrir();
  let abrirManualCompartido=params.get('manual')==='1';
  try{abrirManualCompartido=abrirManualCompartido||sessionStorage.getItem('sta_manual_after_login')==='1';if(abrirManualCompartido)sessionStorage.removeItem('sta_manual_after_login')}catch(_){}
  if(abrirManualCompartido){
    if(params.get('manual')!=='1'){const destino=new URL(location.href);destino.searchParams.set('manual','1');history.replaceState({},'',destino.pathname+destino.search+destino.hash)}
    abrirManualUsuario();return;
  }
  const avisosPorActivar=soportePushDisponible()&&Notification.permission==='default';
  if(!avisosPorActivar&&!['evento','admin','calendario','activar_avisos'].some(k=>params.has(k))) mostrarInvitacionInstalacion();
  if(params.get('activar_avisos')==='1'){
    const nuevaUrl=new URL(window.location.href);nuevaUrl.searchParams.delete('activar_avisos');
    history.replaceState({},'',nuevaUrl.pathname+nuevaUrl.search+nuevaUrl.hash);
    staAbrirDispositivos(usuarioActual?.id);
  }else if(avisosPorActivar&&!['evento','admin','calendario','comunicados','ayuda'].some(k=>params.has(k))){
    staAbrirDispositivos(usuarioActual?.id);
  }
}
function marcarNavActivo(panelId=''){
  const mapa={panelCalendario:'btnCalendario',panelWhatsapp:'btnWhatsapp',panelUsuarios:'btnAdminUsuarios'};
  ['btnGestionEncuestas','btnPresupuestos','btnCalendario','btnWhatsapp','btnAdminUsuarios'].forEach(id=>document.getElementById(id)?.classList.remove('nav-active'));
  if(mapa[panelId])document.getElementById(mapa[panelId])?.classList.add('nav-active');
}
function cerrarPantallasHerramientas(excepto=''){
  for(const id of ['panelGestor','panelCalendario','panelWhatsapp','panelUsuarios','panelContabilidad']){
    if(id!==excepto)document.getElementById(id)?.classList.add('hidden');
  }
  if(excepto){
    document.querySelectorAll('.sta-standalone-screen').forEach(el=>el.classList.remove('sta-standalone-screen'));
    staOcultarNavPantallaInicio();
    document.documentElement.classList.remove('sta-screen-open');
    document.body.classList.remove('sta-screen-open');
  }
  marcarNavActivo(excepto);
  document.body.style.overflow='';
}
function configurarPantallaGestion(modo='gestion'){
  const panel=document.getElementById('panelGestor');
  panel?.classList.toggle('modo-viabilidad',modo==='viabilidad');
  const titulo=document.getElementById('toolScreenTitle');
  const subtitulo=document.getElementById('toolScreenSubtitle');
  const principal=document.querySelector('#panelGestor .gestion-principal-tabs');
  const crear=document.getElementById('gestionCrearContenido');
  const administrar=document.getElementById('gestionAdministrarContenido');
  const subtabs=administrar?.querySelector('.gestion-subtabs');
  const encuestas=document.getElementById('gestionAdminEncuestas');
  const ensayos=document.getElementById('gestionAdminEnsayos');
  const dinero=document.getElementById('gestionAdminPresupuestos');
  if(modo==='dinero'){
    panel?.classList.add('modo-dinero');
    queueMicrotask(staActualizarTituloGestionUniversal);
    if(titulo)titulo.textContent='€ Dinero';
    if(subtitulo)subtitulo.textContent='Presupuestos, facturación y contabilidad.';
    principal?.classList.add('hidden');
    crear?.classList.add('hidden');
    administrar?.classList.remove('hidden');
    subtabs?.classList.add('hidden');
    encuestas?.classList.add('hidden');
    ensayos?.classList.add('hidden');
    dinero?.classList.remove('hidden');
  }else{
    panel?.classList.remove('modo-dinero');
    if(titulo)titulo.textContent='⚙️ Gestión';
    if(subtitulo)subtitulo.textContent='Crear y administrar encuestas y ensayos de Spirit to All.';
    principal?.classList.remove('hidden');
    subtabs?.classList.remove('hidden');
    dinero?.classList.add('hidden');
  }
}
function abrirGestionEncuestas(){if(!staTienePermiso('encuestas'))return;cerrarPantallasHerramientas('panelGestor');configurarPantallaGestion('gestion');document.getElementById('panelGestor').classList.remove('hidden');document.body.style.overflow='hidden';cambiarGestionPrincipal('crear');if(!document.querySelector('#fechasCreacion .fecha-creacion'))anadirFechaCreacion()}
function cerrarGestionEncuestas(){document.getElementById('panelGestor').classList.add('hidden');configurarPantallaGestion('gestion');marcarNavActivo();document.body.style.overflow=''}
function abrirPresupuestosDirecto(){if(!staTienePermiso('contabilidad'))return;staFacturaContextoBolo=null;cerrarPantallasHerramientas('panelGestor');document.getElementById('panelGestor').classList.remove('hidden');document.body.style.overflow='hidden';configurarPantallaGestion('dinero');cambiarDineroVista('presupuestos');cargarSelectorPresupuestos();document.getElementById('btnGestionEncuestas')?.classList.remove('nav-active');document.getElementById('btnPresupuestos')?.classList.add('nav-active');staActualizarHeroGestion();staPushEstadoPwa('dinero');}
const MATERIAL_CORO_URL='https://drive.google.com/drive/folders/134aIwZA8aEgI0GPaPp7Jm_n9k33EKt-A';
function abrirMaterialCoro(){
  const modal=document.getElementById('modalMaterialCoro');
  if(!modal)return;
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
}
function cerrarMaterialCoro(){
  document.getElementById('modalMaterialCoro')?.classList.add('hidden');
  document.body.style.overflow='';
}
function continuarMaterialCoro(){
  window.open('https://drive.google.com/drive/folders/134aIwZA8aEgI0GPaPp7Jm_n9k33EKt-A','_blank','noopener,noreferrer');
  cerrarMaterialCoro();
}
function abrirCalendario(){cerrarPantallasHerramientas('panelCalendario');document.getElementById('panelCalendario').classList.remove('hidden');document.body.style.overflow='hidden';document.getElementById('staBarraEnsayosGestion')?.classList.toggle('hidden',!esGestor());document.getElementById('staEditorEnsayo')?.classList.add('hidden');void staCargarBolosCalendario()}
function cerrarCalendario(){document.getElementById('panelCalendario').classList.add('hidden');marcarNavActivo();document.body.style.overflow=''}
function abrirPanelWhatsapp(){if(!esGestor())return;cerrarPantallasHerramientas('panelWhatsapp');document.getElementById('panelWhatsapp').classList.remove('hidden');document.body.style.overflow='hidden';void cargarSelectorWhatsapp()}
function cerrarPanelWhatsapp(){document.getElementById('panelWhatsapp').classList.add('hidden');marcarNavActivo();document.body.style.overflow=''}
function abrirGestionUsuarios(){if(!esAdmin())return;cerrarPantallasHerramientas('panelUsuarios');document.getElementById('panelUsuarios')?.classList.remove('hidden');document.body.style.overflow='hidden';cargarGestionUsuarios()}
function cerrarGestionUsuarios(){document.getElementById('panelUsuarios')?.classList.add('hidden');marcarNavActivo();document.body.style.overflow='';if(location.search.includes('admin=')){history.replaceState({},'',location.pathname)}}
async function cargarSolicitudes(){if(!esValidador())return;const{data,error}=await supabaseClient.rpc('solicitudes_pendientes');const contador=document.getElementById('contadorSolicitudes'),lista=document.getElementById('listaSolicitudes');if(error){console.error(error);contador.textContent='No se han podido cargar las solicitudes.';return}const solicitudes=data||[];contador.textContent=solicitudes.length===0?'✅ No hay solicitudes pendientes.':solicitudes.length===1?'🟠 1 solicitud pendiente':'🟠 '+solicitudes.length+' solicitudes pendientes';lista.innerHTML=solicitudes.map(s=>`<div style="padding:14px 0;border-top:1px solid #e5e7eb"><strong>${escapeHtml(s.nombre)}</strong><br><span class="muted">${escapeHtml(s.cuerda_nombre||'Sin cuerda')}</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn-yes" onclick="resolverSolicitud('${s.usuario_id}',true)">✅ Aprobar</button><button class="btn-no" onclick="resolverSolicitud('${s.usuario_id}',false)">❌ Rechazar</button></div></div>`).join('')}
async function resolverSolicitud(usuarioId,aprobar){const accion=aprobar?'aprobar':'rechazar';if(!confirm('¿Quieres '+accion+' esta solicitud?'))return;const{error}=await supabaseClient.rpc('resolver_solicitud',{p_usuario_id:usuarioId,p_aprobar:aprobar});if(error){console.error(error);alert('No se ha podido '+accion+' la solicitud.');return}if(aprobar)await avisarAccesoAprobado(usuarioId);await cargarSolicitudes();if(esAdmin())await cargarGestionUsuarios()}

let refrescoDispositivosEnCurso=false;
async function refrescarDispositivosVisibles(){
  const panel=document.getElementById('panelUsuarios');
  if(!esAdmin()||!panel||panel.classList.contains('hidden')||document.hidden||refrescoDispositivosEnCurso)return;
  refrescoDispositivosEnCurso=true;
  try{
    await cargarEstadosNotificaciones();
    actualizarResumenUsuarios();
    panel.querySelectorAll('[data-estado-dispositivo]').forEach(badge=>{
      badge.outerHTML=htmlEstadoNotificaciones(badge.dataset.estadoDispositivo);
    });
    if(document.getElementById('staDialogDispositivos')?.open)staRenderDispositivosEstado();
  }catch(error){console.warn('No se pudo actualizar el estado de los dispositivos:',error)}
  finally{refrescoDispositivosEnCurso=false}
}
setInterval(refrescarDispositivosVisibles,30000);
document.addEventListener('visibilitychange',refrescarDispositivosVisibles);

async function cargarEstadosNotificaciones(){
  if(!esGestor())return;
  const{data,error}=await supabaseClient.rpc('estado_notificaciones_usuarios');
  if(error){console.warn('No se ha podido cargar el estado de notificaciones:',error);notificacionesGestion=new Map();return}
  notificacionesGestion=new Map((data||[]).map(x=>[String(x.usuario_id),Number(x.dispositivos||0)]));
}

async function cargarGestionUsuarios(){
  if(!esAdmin())return;
  const [usuariosRes,solicitudesRes,notificacionesRes,solistasRes,instrumentosRes,direccionRes,accesosRes]=await Promise.all([
    supabaseClient.rpc('usuarios_gestion'),
    supabaseClient.rpc('solicitudes_pendientes'),
    supabaseClient.rpc('estado_notificaciones_usuarios'),
    supabaseClient.rpc('usuarios_solistas_gestion'),
    supabaseClient.rpc('usuarios_instrumentos_gestion'),
    supabaseClient.rpc('sta_usuarios_direccion'),
    supabaseClient.rpc('sta_accesos_usuarios_gestion')
  ]);
  if(usuariosRes.error||solicitudesRes.error){
    console.error('Error cargando gestión de usuarios:',usuariosRes.error||solicitudesRes.error);
    document.getElementById('resumenUsuarios').textContent='❌ No se ha podido cargar la gestión de usuarios.';
    document.getElementById('listaUsuarios').innerHTML='';
    return;
  }
  usuariosGestion=usuariosRes.data||[];
  solicitudesGestion=solicitudesRes.data||[];
  if(accesosRes.error){console.warn('Correo y método de acceso no disponibles:',accesosRes.error);accesosGestion=new Map()}
  else accesosGestion=new Map((accesosRes.data||[]).map(x=>[String(x.usuario_id),{correo:x.correo,metodo:x.metodo}]));
  if(notificacionesRes.error){console.warn('Estado de notificaciones no disponible:',notificacionesRes.error);notificacionesGestion=new Map()}
  else notificacionesGestion=new Map((notificacionesRes.data||[]).map(x=>[String(x.usuario_id),Number(x.dispositivos||0)]));
  if(solistasRes.error){console.warn('Clasificación Coro/Solista no disponible:',solistasRes.error);solistasGestion=new Map()}
  else solistasGestion=new Map((solistasRes.data||[]).map(x=>[String(x.usuario_id),x.es_solista===true]));
  if(instrumentosRes.error){console.warn('Instrumentos de banda no disponibles:',instrumentosRes.error);instrumentosGestion=new Map()}
  else instrumentosGestion=new Map((instrumentosRes.data||[]).map(x=>[String(x.usuario_id),(x.instrumento||'').trim()]));
  direccionGestion=direccionRes.error?null:new Set((direccionRes.data||[]).map(x=>String(x.usuario_id)));
  await staEquipoCargar(true);
  actualizarResumenUsuarios();
  renderGestionUsuarios();
}

async function refrescarGestionUsuarios(){
  const estado=document.getElementById('estadoUsuarios');
  if(estado)estado.textContent='Actualizando...';
  await cargarGestionUsuarios();
}

function dispositivosNotificaciones(usuarioId){return notificacionesGestion.has(String(usuarioId))?notificacionesGestion.get(String(usuarioId)):null}
function htmlEstadoNotificaciones(usuarioId){
  const n=dispositivosNotificaciones(usuarioId);
  const tono=n===null?'unknown':n>0?'on':'off';
  const texto=n===null?'🔔 Estado no disponible':n>0
    ? `🔔 ${n} ${n===1?'dispositivo registrado':'dispositivos registrados'}`
    : '🔕 Ningún dispositivo registrado';
  return `<span class="notif-badge notif-${tono}" data-estado-dispositivo="${escapeHtml(usuarioId)}">${texto}</span>`;
}
function cuerdaIdPorNombre(nombre){const c=CUERDAS.find(x=>x.nombre===nombre);return c?c.id:null}
function opcionesCuerdas(nombreActual){const actual=cuerdaIdPorNombre(nombreActual);return `<option value=""${actual===null?' selected':''}>⚠️ Sin cuerda</option>`+CUERDAS.map(c=>`<option value="${c.id}"${actual===c.id?' selected':''}>${c.nombre}</option>`).join('')}

function actualizarResumenUsuarios(){
  const activos=usuariosGestion.filter(u=>u.aprobado===true&&u.eliminado!==true);
  const miembros=activos.filter(u=>u.rol==='miembro');
  const gestores=activos.filter(u=>u.rol==='gestor');
  const admins=activos.filter(u=>u.rol==='admin');
  const eliminados=usuariosGestion.filter(u=>u.eliminado===true);
  document.getElementById('resumenUsuarios').textContent=`Activos: ${activos.length} · Pendientes: ${solicitudesGestion.length} · Eliminados: ${eliminados.length}`;
  const resumen=document.getElementById('resumenUsuarios');
  const incompletos=activos.filter(u=>!u.nombre?.trim()||!(u.cuerda_id||cuerdaIdPorNombre(u.cuerda_nombre))||!['miembro','gestor','admin','validador'].includes(u.rol)).length;
  const sinAvisos=activos.filter(u=>dispositivosNotificaciones(u.usuario_id)===0).length;
  const sinDatos=activos.filter(u=>dispositivosNotificaciones(u.usuario_id)===null).length;
  resumen.textContent+=` · Perfiles por revisar: ${incompletos} · Sin dispositivo para avisos: ${sinAvisos}`;
  if(sinDatos)resumen.textContent+=` · Estado de avisos sin confirmar: ${sinDatos}`;
  document.getElementById('countPendientes').textContent=`(${solicitudesGestion.length})`;
  document.getElementById('countMiembros').textContent=`(${miembros.length})`;
  document.getElementById('countGestores').textContent=`(${gestores.length})`;
  document.getElementById('countAdministradores').textContent=`(${admins.length})`;
  document.getElementById('countEliminados').textContent=`(${eliminados.length})`;
}

function cambiarPestanaUsuarios(nombre){
  staUsuarioPendienteAbierto=null;
  pestanaUsuariosActual=nombre;
  const ids={pendientes:'usuariosTabPendientes',miembros:'usuariosTabMiembros',gestores:'usuariosTabGestores',administradores:'usuariosTabAdministradores',eliminados:'usuariosTabEliminados'};
  Object.values(ids).forEach(id=>document.getElementById(id)?.classList.remove('activa'));
  document.getElementById(ids[nombre])?.classList.add('activa');
  renderGestionUsuarios();
}

function esSolistaGestion(usuarioId){return solistasGestion.get(String(usuarioId))===true}
function instrumentoGestion(usuarioId){return instrumentosGestion.get(String(usuarioId))||''}
function opcionesInstrumento(valor){
  const base=[['piano','Piano / teclado'],['bateria','Batería'],['guitarra','Guitarra eléctrica'],['bajo','Bajo']];
  const conocidos=new Map(base);
  for(const v of instrumentosGestion.values())if(v&&!conocidos.has(v))conocidos.set(v,etiquetaInstrumento(v));
  if(valor&&!conocidos.has(valor))conocidos.set(valor,etiquetaInstrumento(valor));
  return '<option value=""'+(!valor?' selected':'')+'>Seleccionar…</option>'+[...conocidos].map(([v,t])=>`<option value="${escapeHtml(v)}"${valor===v?' selected':''}>${escapeHtml(t)}</option>`).join('')+'<option value="__nuevo__">＋ Añadir instrumento…</option>';
}
function etiquetaInstrumento(valor){
  const v=(valor||'').trim();
  return ({piano:'Piano / teclado',bateria:'Batería',guitarra:'Guitarra eléctrica',bajo:'Bajo'})[v]||(!v?'Sin instrumento':v.charAt(0).toUpperCase()+v.slice(1));
}
async function cambiarInstrumentoUsuario(usuarioId,valor,select){
  if(!esAdmin())return;
  let instrumento=(valor||'').trim()||null;
  if(instrumento==='__nuevo__'){
    const escrito=prompt('Escribe el instrumento de banda (por ejemplo: violín, saxo, percusión…):','');
    if(escrito===null){await cargarGestionUsuarios();return}
    instrumento=escrito.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(!instrumento){await cargarGestionUsuarios();return}
  }
  if(select)select.disabled=true;
  const{error}=await supabaseClient.rpc('cambiar_instrumento_usuario',{p_usuario_id:usuarioId,p_instrumento:instrumento});
  if(error){console.error(error);alert('No se ha podido cambiar el instrumento. '+(error.message||''));if(select)select.disabled=false;return}
  await cargarGestionUsuarios();
}
async function cambiarFuncionVocalUsuario(usuarioId,valor,select){
  if(!esAdmin())return;
  const esSolista=valor==='solista';
  if(select)select.disabled=true;
  const{error}=await supabaseClient.rpc('cambiar_solista_usuario',{p_usuario_id:usuarioId,p_es_solista:esSolista});
  if(error){console.error(error);alert('No se ha podido cambiar la clasificación Coro/Solista. '+(error.message||''));if(select)select.disabled=false;return}
  await cargarGestionUsuarios();
}

async function cambiarDireccionUsuario(usuarioId,select){
  if(!esAdmin()||!direccionGestion)return;
  select.disabled=true;
  const habilitar=select.value==='si';
  const {error}=await supabaseClient.rpc('sta_cambiar_direccion_usuario',{p_usuario_id:usuarioId,p_puede_dirigir:habilitar});
  select.disabled=false;
  if(error){
    select.value=direccionGestion.has(usuarioId)?'si':'no';
    alert('No se ha podido guardar Posible dirección.');
    return;
  }
  if(habilitar)direccionGestion.add(usuarioId);
  else direccionGestion.delete(usuarioId);
}

function staUsuarioAccesoHtml(id){
  const acceso=accesosGestion.get(String(id));
  if(!acceso)return '<div class="sta-user-access"><small>Correo y método de acceso no disponibles.</small></div>';
  return `<div class="sta-user-access"><strong>Correo: ${escapeHtml(acceso.correo||'No disponible')}</strong><small>Acceso: ${escapeHtml(acceso.metodo||'No disponible')}${String(acceso.metodo||'').includes('contraseña')?' · Si no recuerda la contraseña, puede usar «¿Has olvidado tu contraseña?» al entrar.':''}</small></div>`;
}
let staUsuarioPendienteAbierto=null;
function renderGestionUsuarios(){
  const estado=document.getElementById('estadoUsuarios'),lista=document.getElementById('listaUsuarios');
  if(!estado||!lista)return;
  const abiertos=new Set([...lista.querySelectorAll('.usuario-row.usuario-open')].map(el=>el.id));
  if(staUsuarioPendienteAbierto)abiertos.add('usuario-'+staUsuarioPendienteAbierto);

  if(pestanaUsuariosActual==='pendientes'){
    const arr=solicitudesGestion;
    estado.textContent=arr.length===0?'✅ No hay solicitudes pendientes.':arr.length===1?'1 solicitud pendiente':arr.length+' solicitudes pendientes';
    lista.innerHTML=arr.map(s=>`<div class="usuario-row"><div class="usuario-grid"><div><div class="usuario-nombre">${escapeHtml(s.nombre||'Sin nombre')}</div><div class="muted">${escapeHtml(s.cuerda_nombre||'Sin cuerda')}</div>${staUsuarioAccesoHtml(s.usuario_id)}</div><div class="usuario-acciones"><button class="btn-yes" onclick="resolverSolicitudGestion('${s.usuario_id}',true)">✅ Aprobar</button><button class="btn-no" onclick="resolverSolicitudGestion('${s.usuario_id}',false)">❌ Rechazar</button></div></div></div>`).join('')||'<p class="muted">No hay solicitudes pendientes.</p>';
    return;
  }

  let arr=[];
  if(pestanaUsuariosActual==='miembros')arr=usuariosGestion.filter(u=>u.aprobado===true&&u.eliminado!==true&&u.rol==='miembro');
  if(pestanaUsuariosActual==='gestores')arr=usuariosGestion.filter(u=>u.aprobado===true&&u.eliminado!==true&&u.rol==='gestor');
  if(pestanaUsuariosActual==='administradores')arr=usuariosGestion.filter(u=>u.aprobado===true&&u.eliminado!==true&&u.rol==='admin');
  if(pestanaUsuariosActual==='eliminados')arr=usuariosGestion.filter(u=>u.eliminado===true);

  estado.textContent=arr.length===1?'1 usuario':arr.length+' usuarios';

  if(pestanaUsuariosActual==='eliminados'){
    lista.innerHTML=arr.map(u=>`<div class="usuario-row"><div class="usuario-grid"><div><div class="usuario-nombre">${escapeHtml(u.nombre||'Sin nombre')}</div><div class="muted">${escapeHtml(u.cuerda_nombre||'Sin cuerda')}</div>${staUsuarioAccesoHtml(u.usuario_id)}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn-primary btn-full" style="margin:0" onclick="restaurarUsuario('${u.usuario_id}')">↩️ Reactivar</button><button class="btn-no btn-full" style="margin:0" onclick="eliminarUsuarioDefinitivo('${u.usuario_id}')">🗑️ Eliminar definitivamente</button></div></div></div>`).join('')||'<p class="muted">No hay usuarios eliminados.</p>';
    return;
  }

  lista.innerHTML=arr.map(u=>{
    const esYo=usuarioActual&&u.usuario_id===usuarioActual.id;
    const rolActual=['miembro','gestor','admin'].includes(u.rol)?u.rol:'miembro';
    const cuerda=u.cuerda_nombre?'🎵 '+escapeHtml(u.cuerda_nombre):'⚠️ Sin cuerda asignada';
    const rolTexto=rolActual==='admin'?'Administrador':rolActual==='gestor'?'Gestor':'Miembro';
    const esBanda=(u.cuerda_nombre||'').trim()==='Banda';
    const instrumento=instrumentoGestion(u.usuario_id);
    return `<div class="usuario-row" id="usuario-${u.usuario_id}"><button type="button" class="usuario-summary" aria-expanded="false" onclick="toggleUsuarioDetalles('${u.usuario_id}')"><div class="usuario-summary-main"><div class="usuario-summary-name">${escapeHtml(u.nombre||'Sin nombre')}${esYo?' <span class="badge badge-respondida">Tú</span>':''}</div><div class="usuario-summary-meta">${cuerda} · ${rolTexto}${esBanda&&instrumento?' · '+escapeHtml(etiquetaInstrumento(instrumento)):''}</div></div><span class="usuario-chevron">⌄</span></button><div class="usuario-details">${staUsuarioAccesoHtml(u.usuario_id)}<div class="sta-user-devices">${htmlEstadoNotificaciones(u.usuario_id)}<button type="button" onclick="staAbrirDispositivos('${u.usuario_id}')">🔔 Gestionar dispositivos</button></div><div class="usuario-controles"><label class="control-label">Cuerda<select onchange="cambiarCuerdaUsuario('${u.usuario_id}',this.value,'${escapeHtml(u.cuerda_nombre||'')}',this)">${opcionesCuerdas(u.cuerda_nombre)}</select></label><label class="control-label">Permiso<select class="rol-select" onchange="cambiarRolUsuario('${u.usuario_id}',this.value,'${rolActual}',this)"><option value="miembro"${rolActual==='miembro'?' selected':''}>Miembro</option><option value="gestor"${rolActual==='gestor'?' selected':''}>Gestor</option><option value="admin"${rolActual==='admin'?' selected':''}>Administrador</option></select></label><label class="control-label">Solista<select class="solista-select" onchange="cambiarFuncionVocalUsuario('${u.usuario_id}',this.value,this)"><option value="coro"${!esSolistaGestion(u.usuario_id)?' selected':''}>No</option><option value="solista"${esSolistaGestion(u.usuario_id)?' selected':''}>Sí</option></select></label><label class="control-label">Posible dirección<select onchange="cambiarDireccionUsuario('${u.usuario_id}',this)" ${direccionGestion?'':'disabled'}>${direccionGestion?`<option value="no" ${direccionGestion.has(String(u.usuario_id))?'':'selected'}>No</option><option value="si" ${direccionGestion.has(String(u.usuario_id))?'selected':''}>Sí</option>`:'<option>No disponible</option>'}</select></label>${rolActual!=='miembro'?staUsuariosAreasEditor(u.usuario_id):`<button class="btn-light" type="button" onclick="staPermisosAbrirEditor('${u.usuario_id}')">Permisos individuales</button>`}${esBanda?`<label class="control-label instrumento-wrap">Instrumento<select onchange="cambiarInstrumentoUsuario('${u.usuario_id}',this.value,this)">${opcionesInstrumento(instrumento)}</select><span class="instrumento-help">Necesario para calcular la base instrumental.</span></label>`:''}<button class="btn-no btn-delete-user" onclick="eliminarUsuario('${u.usuario_id}')" ${esYo?'disabled title="No puedes quitar tu propia cuenta"':''}>🗑️ Quitar</button></div></div></div>`;
  }).join('')||'<p class="muted">No hay usuarios en esta sección.</p>';
  for(const id of abiertos){const fila=document.getElementById(id);if(fila){fila.classList.add('usuario-open');fila.querySelector('.usuario-summary')?.setAttribute('aria-expanded','true');if(id==='usuario-'+staUsuarioPendienteAbierto)staUsuarioPendienteAbierto=null}}
}
function toggleUsuarioDetalles(usuarioId){const fila=document.getElementById('usuario-'+usuarioId);if(!fila)return;const abierto=fila.classList.toggle('usuario-open');fila.querySelector('.usuario-summary')?.setAttribute('aria-expanded',String(abierto))}

async function resolverSolicitudGestion(usuarioId,aprobar){
  const accion=aprobar?'aprobar':'rechazar';
  if(!confirm('¿Quieres '+accion+' esta solicitud?'))return;
  const{error}=await supabaseClient.rpc('resolver_solicitud',{p_usuario_id:usuarioId,p_aprobar:aprobar});
  if(error){console.error(error);alert('No se ha podido '+accion+' la solicitud.');return}
  if(aprobar)await avisarAccesoAprobado(usuarioId);
  await cargarGestionUsuarios();
}
async function avisarAccesoAprobado(usuarioId){
  try{
    const{data,error}=await esperarAvisos(supabaseClient.functions.invoke('enviar-notificaciones',{
      body:{tipo:'acceso_aprobado',usuario_id:usuarioId}
    }),'El servicio de avisos no confirmó el envío.');
    if(error||!data?.ok)throw new Error(data?.error||error?.message||'Envío sin confirmar.');
    if(Number(data.enviados)===0)alert('Acceso aprobado. Aún no hay un dispositivo de esa persona registrado para recibir push. Puede entrar en Spirit y pulsar «Mis dispositivos» → «Activar / registrar este dispositivo».');
    else if(Number(data.enviados)>0)alert('Acceso aprobado. Se envió el aviso a sus dispositivos registrados.');
    else alert('Acceso aprobado. El servicio procesó el aviso, pero no indicó cuántos dispositivos lo recibieron.');
  }catch(error){
    console.warn('Acceso aprobado, aviso no confirmado:',error);
    alert('Acceso aprobado. El envío del aviso push no se pudo confirmar. La persona ya puede entrar en Spirit.');
  }
}

async function cambiarCuerdaUsuario(usuarioId,nuevaCuerdaId,cuerdaAnteriorNombre,select){
  if(!esAdmin())return;
  const nueva=Number(nuevaCuerdaId);
  const anterior=cuerdaIdPorNombre((cuerdaAnteriorNombre||'').trim());
  if(!nueva){alert('Selecciona una cuerda válida.');if(select)select.value=anterior||'';return}
  if(nueva===anterior)return;
  const nombre=CUERDAS.find(c=>c.id===nueva)?.nombre||'la nueva cuerda';
  if(!confirm('¿Cambiar la cuerda de este usuario a '+nombre+'?')){if(select)select.value=anterior||'';return}
  if(select)select.disabled=true;
  const{error}=await supabaseClient.rpc('cambiar_cuerda_usuario',{p_usuario_id:usuarioId,p_cuerda_id:nueva});
  if(error){console.error(error);alert('No se ha podido cambiar la cuerda. '+(error.message||''));if(select){select.value=anterior||'';select.disabled=false}return}
  await cargarGestionUsuarios();
  await cargarTodo();
}

async function cambiarRolUsuario(usuarioId,nuevoRol,rolAnterior,select){
  if(!esAdmin()||nuevoRol===rolAnterior)return;
  const nombres={miembro:'Miembro',gestor:'Gestor',admin:'Administrador'};
  if(!confirm('¿Cambiar este usuario a '+(nombres[nuevoRol]||nuevoRol)+'?')){if(select)select.value=rolAnterior;return}
  if(select)select.disabled=true;
  const{error}=await supabaseClient.rpc('cambiar_rol_usuario',{p_usuario_id:usuarioId,p_rol:nuevoRol});
  if(error){console.error(error);alert('No se ha podido cambiar el rol. '+(error.message||''));if(select){select.value=rolAnterior;select.disabled=false}return}
  if(usuarioActual&&usuarioId===usuarioActual.id){alert('✅ Rol actualizado. La aplicación se recargará.');location.reload();return}
  staUsuarioPendienteAbierto=usuarioId;
  const nuevaPestana={miembro:'miembros',gestor:'gestores',admin:'administradores'}[nuevoRol];
  if(nuevaPestana&&nuevaPestana!==pestanaUsuariosActual){pestanaUsuariosActual=nuevaPestana;document.querySelectorAll('#panelUsuarios [id^="usuariosTab"]')?.forEach(tab=>tab.classList.remove('activa'));document.getElementById(({miembros:'usuariosTabMiembros',gestores:'usuariosTabGestores',administradores:'usuariosTabAdministradores'})[nuevaPestana])?.classList.add('activa')}
  await cargarGestionUsuarios();
}

async function eliminarUsuario(usuarioId){
  if(!esAdmin())return;
  const u=usuariosGestion.find(x=>x.usuario_id===usuarioId),nombre=u?.nombre||'este usuario';
  if(usuarioActual&&usuarioId===usuarioActual.id){alert('No puedes quitar tu propio usuario desde aquí.');return}
  if(!confirm('¿Quitar a '+nombre+' de Spirit to All?\n\nPerderá el acceso y dejará de recibir notificaciones. Su historial se conservará.'))return;
  const{error}=await supabaseClient.rpc('eliminar_usuario',{p_usuario_id:usuarioId});
  if(error){console.error(error);alert('No se ha podido quitar el usuario. '+(error.message||''));return}
  await cargarGestionUsuarios();cambiarPestanaUsuarios('eliminados');
}

async function restaurarUsuario(usuarioId){
  if(!esAdmin())return;
  const u=usuariosGestion.find(x=>x.usuario_id===usuarioId);
  if(!confirm('¿Reactivar a '+(u?.nombre||'este usuario')+' como miembro?'))return;
  const{error}=await supabaseClient.rpc('restaurar_usuario',{p_usuario_id:usuarioId});
  if(error){console.error(error);alert('No se ha podido reactivar el usuario. '+(error.message||''));return}
  await cargarGestionUsuarios();cambiarPestanaUsuarios('miembros');
}

function eliminarUsuarioDefinitivo(usuarioId){
  if(!esAdmin())return;
  const usuario=usuariosGestion.find(u=>u.usuario_id===usuarioId&&u.eliminado===true);
  if(!usuario||usuarioId===usuarioActual?.id)return;
  const dialogo=document.getElementById('staEliminarPerfil');
  if(dialogo.open)return;
  document.getElementById('staEliminarNombre').textContent=usuario.nombre||'este perfil';
  const cancelar=document.getElementById('staCancelarEliminar');
  const boton=document.getElementById('staConfirmarEliminar');
  const estado=document.getElementById('staEstadoEliminar');
  estado.textContent='';
  boton.onclick=async()=>{
    if(boton.disabled||!esAdmin()||usuarioId===usuarioActual?.id)return;
    boton.disabled=true;
    cancelar.disabled=true;
    estado.textContent='Eliminando…';
    try{
      const {error}=await supabaseClient.rpc('eliminar_usuario_definitivo',{p_usuario_id:usuarioId});
      if(error)throw error;
    }catch(error){
      estado.textContent='No se ha podido confirmar la eliminación. '+(error.message||'Comprueba la conexión.');
      return;
    }finally{
      boton.disabled=false;
      cancelar.disabled=false;
    }
    dialogo.close();
    await cargarGestionUsuarios();
    cambiarPestanaUsuarios('eliminados');
    alert('Usuario eliminado definitivamente.');
  };
  dialogo.showModal();
}

function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const rawData=atob(base64);return Uint8Array.from([...rawData].map(char=>char.charCodeAt(0)))}
function clavesIguales(a,b){
  if(!a||!b)return false;
  const x=new Uint8Array(a),y=new Uint8Array(b);
  if(x.length!==y.length)return false;
  for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
  return true;
}
function esperarAvisos(promesa,mensaje,ms=12000){
  let temporizador;
  const limite=new Promise((_,rechazar)=>{
    temporizador=setTimeout(()=>rechazar(new Error(mensaje)),ms);
  });
  return Promise.race([promesa,limite]).finally(()=>clearTimeout(temporizador));
}
async function obtenerVapidPublicKey(){
  if(vapidPublicKeyCache)return vapidPublicKeyCache;
  const {data,error}=await esperarAvisos(supabaseClient.functions.invoke('enviar-notificaciones',{body:{tipo:'config'}}),'El servicio de avisos no responde.');
  if(error||!data?.ok||!data?.vapidPublicKey)throw new Error(data?.error||error?.message||'No se ha podido obtener la clave pública de notificaciones.');
  vapidPublicKeyCache=data.vapidPublicKey;
  return vapidPublicKeyCache;
}
let registroAvisosEnCurso=null;
let desactivandoAvisos=false;
const claveAvisosDesactivados='sta-avisos-desactivados-dispositivo';
function avisosDesactivadosAqui(){
  try{return localStorage.getItem(claveAvisosDesactivados)==='1'}catch(_){return false}
}

function sincronizarSuscripcionActual(){
  const usuarioId=usuarioActual?.id;
  if(desactivandoAvisos)return Promise.reject(new Error('Espera a que termine la desactivación.'));
  if(!usuarioId||Notification.permission!=='granted')return Promise.reject(new Error('Autoriza las notificaciones en este dispositivo.'));
  if(registroAvisosEnCurso){
    if(registroAvisosEnCurso.usuarioId===usuarioId)return registroAvisosEnCurso.promesa;
    return Promise.reject(new Error('Espera a que termine el registro anterior y vuelve a intentarlo.'));
  }
  const promesa=registrarSuscripcionActual(usuarioId).finally(()=>{registroAvisosEnCurso=null});
  registroAvisosEnCurso={usuarioId,promesa};
  return promesa;
}
async function staRegistroPropioParaAvisos(){
  const alcance=new URL('./',URL_ACCESO).href;
  const archivo=new URL('sw.js',alcance).href;
  const localizar=()=>navigator.serviceWorker.getRegistration(alcance);
  let registro=await esperarAvisos(localizar(),'No se pudo consultar el registro de avisos de Spirit.');
  if(!registro?.active){
    await esperarAvisos(navigator.serviceWorker.ready,'Abre Spirit desde su propio icono y vuelve a intentarlo.');
    registro=await esperarAvisos(localizar(),'No se pudo consultar el registro de avisos de Spirit.');
  }
  if(registro?.scope!==alcance||registro.active?.scriptURL!==archivo){
    throw new Error('Abre Spirit desde su propio icono para activar o desactivar sus avisos.');
  }
  return registro;
}
async function registrarSuscripcionActual(usuarioId){
  const vapid=await obtenerVapidPublicKey();
  const clave=urlBase64ToUint8Array(vapid);
  const registro=await staRegistroPropioParaAvisos();
  let suscripcion=await esperarAvisos(registro.pushManager.getSubscription(),'El navegador no ha podido consultar la suscripción.');
  if(suscripcion&&!clavesIguales(suscripcion.options?.applicationServerKey,clave)){
    await esperarAvisos(suscripcion.unsubscribe(),'No se pudo renovar la suscripción.');
    suscripcion=null;
  }
  if(!suscripcion)suscripcion=await esperarAvisos(registro.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:clave}),'El navegador no ha terminado de activar los avisos.');
  if(usuarioActual?.id!==usuarioId)throw new Error('Vuelve a iniciar sesión para activar los avisos.');
  const json=suscripcion.toJSON();
  const{data,error}=await esperarAvisos(supabaseClient.functions.invoke('enviar-notificaciones',{body:{tipo:'registrar_suscripcion',endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth}}),'El servidor no ha confirmado el registro de este dispositivo.');
  if(error||!data?.ok)throw new Error(data?.error||error?.message||'No se ha podido registrar este dispositivo.');
  return suscripcion;
}
async function comprobarAprobacion(){
  const boton=document.getElementById('staComprobarAprobacion');
  const estado=document.getElementById('staEstadoAprobacion');
  if(boton.disabled)return;
  boton.disabled=true;
  estado.textContent='Comprobando tu solicitud…';
  try{
    await comprobarUsuario();
    estado.textContent=document.getElementById('accesoPendiente').classList.contains('hidden')?'':'Tu solicitud sigue pendiente.';
  }catch(error){
    estado.textContent='No se ha podido comprobar tu solicitud. Inténtalo de nuevo.';
  }finally{
    boton.disabled=false;
  }
}

async function actualizarAvisosDispositivo(pendiente,solicitarPermiso){
  const texto=document.getElementById(pendiente?'estadoAvisoAprobacion':'estadoNotificaciones');
  const boton=document.getElementById(pendiente?'btnAvisoAprobacion':'btnNotificaciones');
  const zona=pendiente?null:document.getElementById('zonaNotificaciones');
  if(!texto||!boton||!usuarioActual||boton.dataset.registrando)return;
  const necesitaInstalar=esIOS()&&!estaEnModoApp();
  document.getElementById(pendiente?'staInstalarParaAvisos':'staInstalarParaAvisosInicio')?.classList.toggle('hidden',!necesitaInstalar);
  zona?.classList.remove('config-ok');
  boton.classList.remove('hidden','is-ok');
  boton.disabled=false;
  boton.textContent=pendiente?'🔔 Activar aviso de aprobación':'🔔 Activar notificaciones';
  if(!soportePushDisponible()||necesitaInstalar){
    texto.textContent=esIOS()?mensajeIOSNotificaciones():'Este navegador o dispositivo no admite avisos push.';
    boton.classList.add('hidden');
    return;
  }
  if(Notification.permission==='denied'){
    texto.textContent='Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador o del dispositivo y vuelve a abrir Spirit.';
    boton.classList.add('hidden');
    return;
  }
  if(avisosDesactivadosAqui()&&!solicitarPermiso){
    texto.textContent='Los avisos están desactivados en este dispositivo.';
    return;
  }
  if(Notification.permission!=='granted'&&!solicitarPermiso){
    texto.textContent=pendiente?'Pulsa el botón y elige «Permitir» para recibir el aviso cuando aprueben tu acceso.':'Pulsa el botón y elige «Permitir» para recibir avisos de encuestas, ensayos y actuaciones.';
    return;
  }
  boton.dataset.registrando='1';
  boton.disabled=true;
  let activo=false;
  let fallo=false;
  try{
    if(Notification.permission!=='granted'){
      texto.textContent='Responde al permiso de notificaciones del navegador…';
      const permiso=await esperarAvisos(Notification.requestPermission(),'El permiso sigue pendiente. Revisa el aviso del navegador.',25000);
      if(permiso!=='granted'){
        texto.textContent=permiso==='denied'?'Permite las notificaciones en los ajustes del navegador o del dispositivo.':'Puedes activar los avisos cuando quieras.';
        return;
      }
    }
    texto.textContent='Registrando este dispositivo…';
    boton.textContent='Registrando…';
    await sincronizarSuscripcionActual();
    try{localStorage.removeItem(claveAvisosDesactivados)}catch(_){}
    activo=true;
    texto.textContent=pendiente?'✅ Aviso activado en este dispositivo.':'✅ Avisos activados en este dispositivo.';
    zona?.classList.add('config-ok');
    if(esGestor())void cargarEstadosNotificaciones().then(()=>{
      if(esAdmin()){actualizarResumenUsuarios();renderGestionUsuarios()}
    }).catch(error=>console.warn('No se pudo actualizar el resumen de avisos:',error));
  }catch(error){
    fallo=true;
    texto.textContent=(error.message||'No se ha podido registrar el dispositivo.')+' Puedes reintentar.';
  }finally{
    delete boton.dataset.registrando;
    boton.disabled=activo;
    boton.classList.toggle('hidden',(activo&&!pendiente)||Notification.permission==='denied');
    boton.classList.toggle('is-ok',activo&&pendiente);
    if(activo)boton.textContent='✅ Aviso activado';
    else if(fallo)boton.textContent='Reintentar activación';
  }
}
function prepararAvisosPendiente(){
  if(usuarioActual){
    try{localStorage.setItem('sta-acceso-pendiente:'+usuarioActual.id,'1')}catch(_){}
  }
  return actualizarAvisosDispositivo(true,false);
}
function activarAvisoAprobacion(){return actualizarAvisosDispositivo(true,true)}
function comprobarEstadoNotificaciones(){return actualizarAvisosDispositivo(false,false)}
async function activarNotificaciones(){
  await actualizarAvisosDispositivo(false,true);
  if(document.getElementById('zonaNotificaciones')?.classList.contains('config-ok')&&
     !document.getElementById('staDialogDispositivos')?.open)mostrarInvitacionInstalacion();
}
// Gestión de dispositivos: cada suscripción push pertenece al dispositivo/navegador y a la sesión autenticada.
let staDispositivoObjetivoId='';
function staEsMiDispositivoObjetivo(){return !!usuarioActual&&String(staDispositivoObjetivoId)===String(usuarioActual.id)}
function staUrlActivacion(){
  const url=new URL(window.location.href);
  url.search='';url.searchParams.set('activar_avisos','1');url.hash='';
  return url.toString();
}
function staMensajeActivacionUsuario(){
  const usuario=usuariosGestion.find(u=>String(u.usuario_id)===String(staDispositivoObjetivoId));
  const nombre=String(usuario?.nombre||'').trim().split(/\s+/)[0];
  return `¡Hola${nombre?', '+nombre:''}! 🔔 Para recibir los avisos de Spirit to All en tu móvil, iPhone, tableta u ordenador, registra ese dispositivo con TU PROPIA cuenta.\n\n1. Abre este enlace en el dispositivo donde quieres recibir avisos: ${staUrlActivacion()}\n2. Inicia sesión con tu usuario de Spirit to All.\n3. Pulsa «Activar avisos en este dispositivo» y acepta el permiso.\n\n📱 Si es iPhone o iPad, primero añade Spirit to All a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ese icono. Se necesita iOS/iPadOS 16.4 o posterior.\n\nPuedes repetirlo en otros dispositivos. No compartas tu contraseña.`;
}
function staCerrarDispositivos(){
  const d=document.getElementById('staDialogDispositivos');
  if(d?.open)d.close();
}
function staRenderDispositivosEstado(){
  const estado=document.getElementById('staDispositivosEstado');
  const sub=document.getElementById('staDialogDispositivosSubtitulo');
  const titulo=document.getElementById('staDialogDispositivosTitulo');
  const explic=document.getElementById('staDispositivosExplicacion');
  const btnRegistrar=document.getElementById('staBtnRegistrarEste');
  if(!estado||!sub||!titulo||!explic||!btnRegistrar)return;
  const esYo=staEsMiDispositivoObjetivo();
  const u=usuariosGestion.find(x=>String(x.usuario_id)===String(staDispositivoObjetivoId));
  const nombre=esYo?(perfilActual?.nombre||'Mi cuenta'):(u?.nombre||'Este usuario');
  titulo.textContent=esYo?'🔔 Mis dispositivos y avisos push':'🔔 Dispositivos y avisos push';
  sub.textContent=esYo?'Mi cuenta · '+nombre:nombre+' · Registro personal';
  const n=dispositivosNotificaciones(staDispositivoObjetivoId);
  estado.textContent=esYo?(avisosDesactivadosAqui()?'Avisos desactivados en este dispositivo.':
    (esIOS()&&!estaEnModoApp())||!soportePushDisponible()?(esIOS()?mensajeIOSNotificaciones():'Este navegador no admite avisos push.'):
    Notification.permission==='denied'?'Avisos bloqueados en los ajustes del navegador.':
    document.getElementById('zonaNotificaciones')?.classList.contains('config-ok')?'Avisos activos en este dispositivo.':'Puedes activar los avisos en este dispositivo.'):
    n===null?'El número de dispositivos no está disponible. Puedes actualizarlo.':
    n===0?'🔕 No hay dispositivos registrados en esta cuenta.':
    `✅ ${n} ${n===1?'dispositivo registrado':'dispositivos registrados'} para recibir avisos.`;
  document.getElementById('staBtnDesactivarEste')?.classList.toggle('hidden',!esYo||!soportePushDisponible()||avisosDesactivadosAqui());
  document.getElementById('staBtnProbarPush')?.classList.toggle('hidden',!esAdmin()||!staDispositivoObjetivoId);
  if(esYo){
    explic.textContent=(n===null?'':n===1?'Tienes 1 dispositivo registrado. ':'Tienes '+n+' dispositivos registrados. ')+'Para vincular otro móvil, tableta u ordenador, abre Spirit allí y activa los avisos.';
    btnRegistrar.classList.remove('hidden');
    btnRegistrar.textContent='🔔 Activar / registrar este dispositivo';
  }else{
    explic.textContent='No puedes activar las notificaciones de '+nombre+' a distancia. Comparte el enlace de activación: esa persona debe abrirlo desde su propio dispositivo, iniciar sesión y aceptar las notificaciones. Después podrás actualizar su contador en Usuarios.';
    btnRegistrar.classList.add('hidden');
  }
}
async function staAbrirDispositivos(usuarioId){
  if(!usuarioActual)return;
  const id=String(usuarioId||usuarioActual.id);
  const esYo=id===String(usuarioActual.id);
  if(!esYo&&!esAdmin())return;
  const dialogo=document.getElementById('staDialogDispositivos');
  if(!dialogo)return;
  staDispositivoObjetivoId=id;
  const feedback=document.getElementById('staDispositivosFeedback');
  if(feedback)feedback.textContent='';
  staRenderDispositivosEstado();
  if(!dialogo.open)dialogo.showModal();
  // Los recuentos se refrescan desde Supabase; nunca se presume que un permiso del navegador sea un envío válido.
  if(esGestor()){
    try{await cargarEstadosNotificaciones();if(staDispositivoObjetivoId===id)staRenderDispositivosEstado()}
    catch(error){console.warn('No se pudo actualizar el recuento de dispositivos:',error)}
  }
}
async function staProbarPushIndividual(){
  if(!esAdmin()||!staDispositivoObjetivoId)return;
  const id=staDispositivoObjetivoId,boton=document.getElementById('staBtnProbarPush'),estado=document.getElementById('staDispositivosFeedback');
  if(!boton||!estado)return;
  boton.disabled=true;estado.textContent='Enviando una prueba solo a esta persona…';
  try{
    const {data,error}=await supabaseClient.functions.invoke('avisos-colaboracion',{body:{tipo:'prueba_individual',usuario_id:id}});
    if(error||!data?.ok)throw new Error(data?.error||error?.message||'No se pudo enviar la prueba.');
    estado.textContent=data.enviados?`✅ Prueba enviada a ${data.enviados} dispositivo(s) de esta persona. Confirma con ella si apareció en su móvil.`:'No tiene dispositivos disponibles para recibir el push. Debe activar los avisos desde su propio dispositivo.';
    await cargarEstadosNotificaciones();staRenderDispositivosEstado();
  }catch(e){estado.textContent='❌ '+(e.message||'No se pudo enviar la prueba.')}
  finally{boton.disabled=false}
}
async function staRegistrarDispositivoPropio(){
  if(!staEsMiDispositivoObjetivo())return;
  const feedback=document.getElementById('staDispositivosFeedback');
  const boton=document.getElementById('staBtnRegistrarEste');
  if(!feedback||!boton||boton.disabled||desactivandoAvisos)return;
  if(!soportePushDisponible()){
    feedback.textContent=esIOS()?mensajeIOSNotificaciones():'Este dispositivo o navegador no admite avisos push.';
    return;
  }
  if(Notification.permission==='denied'){
    feedback.textContent='🔕 Este navegador tiene las notificaciones bloqueadas. Cambia el permiso en Ajustes y vuelve a intentarlo.';
    return;
  }
  boton.disabled=true;
  try{
    // La solicitud de permiso se produce solo al pulsar el botón en el dispositivo del propio usuario.
    const permiso=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    if(permiso!=='granted'){
      feedback.textContent='No se han autorizado las notificaciones. Puedes volver a intentarlo cuando quieras.';
      return;
    }
    boton.disabled=true;boton.textContent='Registrando este dispositivo…';feedback.textContent='Conectando con el servicio de notificaciones…';
    const suscripcion=await sincronizarSuscripcionActual();
    if(!suscripcion)throw new Error('No se ha podido crear la suscripción push.');
    try{localStorage.removeItem(claveAvisosDesactivados)}catch(_){}
    feedback.textContent='✅ Este dispositivo se ha registrado correctamente. Puedes registrar otros iniciando sesión en ellos.';
    await comprobarEstadoNotificaciones();
    if(esGestor())await cargarEstadosNotificaciones();
    staRenderDispositivosEstado();
  }catch(error){
    console.error('Fallo registrando dispositivo:',error);
    feedback.textContent=esIOS()&&!estaEnModoApp()?mensajeIOSNotificaciones():
      '❌ No se ha podido registrar el dispositivo. Revisa los permisos, la conexión y vuelve a intentarlo.';
  }finally{boton.disabled=false;boton.textContent='🔔 Activar / registrar este dispositivo'}
}
async function staDesactivarDispositivoPropio(){
  if(!staEsMiDispositivoObjetivo()||!soportePushDisponible()||desactivandoAvisos)return;
  const feedback=document.getElementById('staDispositivosFeedback');
  const boton=document.getElementById('staBtnDesactivarEste');
  const activar=document.getElementById('staBtnRegistrarEste');
  if(registroAvisosEnCurso||activar.disabled){
    feedback.textContent='Espera a que termine la activación.';
    return;
  }
  desactivandoAvisos=true;
  boton.disabled=true;
  activar.disabled=true;
  feedback.textContent='Desactivando avisos de este dispositivo…';
  const usuarioId=usuarioActual.id;
  try{
    const registro=await staRegistroPropioParaAvisos();
    const suscripcion=await esperarAvisos(registro.pushManager.getSubscription(),'No se pudo consultar este dispositivo.');
    if(suscripcion){
      if(usuarioActual?.id!==usuarioId)throw new Error('La sesión ha cambiado.');
      const {error}=await esperarAvisos(supabaseClient.rpc('sta_quitar_dispositivo_push',{
        p_endpoint:suscripcion.endpoint
      }),'Supabase no confirmó la baja del dispositivo.');
      if(error)throw error;
    }
    localStorage.setItem(claveAvisosDesactivados,'1');
    if(suscripcion)await esperarAvisos(suscripcion.unsubscribe(),'El navegador no confirmó la baja.').catch(error=>console.warn(error));
    feedback.textContent='Avisos desactivados en este dispositivo.';
    document.getElementById('zonaNotificaciones')?.classList.remove('config-ok');
    document.getElementById('estadoNotificaciones').textContent='Los avisos están desactivados en este dispositivo.';
    document.getElementById('btnNotificaciones').classList.remove('hidden');
    document.getElementById('btnNotificaciones').disabled=false;
    document.getElementById('btnNotificaciones').textContent='Activar notificaciones';
    if(esGestor()){
      await cargarEstadosNotificaciones();
      if(esAdmin()){actualizarResumenUsuarios();renderGestionUsuarios()}
    }
    staRenderDispositivosEstado();
  }catch(error){
    console.warn('No se pudo desactivar el dispositivo:',error);
    feedback.textContent='No se pudo confirmar la desactivación. Vuelve a intentarlo.';
  }finally{
    desactivandoAvisos=false;
    boton.disabled=false;
    activar.disabled=false;
  }
}
function staCompartirActivacionUsuario(){
  if(!usuarioActual)return;
  const mensaje=staMensajeActivacionUsuario();
  // Abre WhatsApp para que el administrador elija destinatario; nunca envía mensajes por su cuenta.
  const url='https://wa.me/?text='+encodeURIComponent(mensaje);
  const ventana=window.open(url,'_blank','noopener,noreferrer');
  const feedback=document.getElementById('staDispositivosFeedback');
  if(feedback)feedback.textContent=ventana?'Selecciona el contacto en WhatsApp para enviar las instrucciones.':'Si WhatsApp no se abre, pulsa «Copiar instrucciones y enlace».';
}
async function staCopiarActivacionUsuario(){
  const mensaje=staMensajeActivacionUsuario();
  const feedback=document.getElementById('staDispositivosFeedback');
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard no disponible');
    await navigator.clipboard.writeText(mensaje);
    if(feedback)feedback.textContent='✅ Instrucciones copiadas. Pégalas en el WhatsApp de la persona.';
  }catch(error){
    window.prompt('Copia estas instrucciones y compártelas:',mensaje);
    if(feedback)feedback.textContent='Comparte las instrucciones con la persona para que las abra en su dispositivo.';
  }
}

async function cargarTodo(){
  const lista=document.getElementById('listaEventos');
  const contador=document.getElementById('contadorPendientes');
  if(lista)lista.innerHTML='<div class="empty">Cargando encuestas…</div>';
  if(contador)contador.textContent='Cargando encuestas…';
  try{
    const{data,error}=await supabaseClient.rpc('cargar_encuestas_usuario');
    if(error)throw error;
    if(!data||!Array.isArray(data.eventos)||!Array.isArray(data.fechas)||!Array.isArray(data.respuestas))throw new Error('Respuesta de encuestas incompleta');
    const payload=data;
    const {eventos,fechas,respuestas}=payload;

    // Normalizamos y deduplicamos por ID para que una misma encuesta o fecha nunca se pinte dos veces,
    // aunque el origen de datos llegara a devolver accidentalmente una fila repetida.
    const eventosUnicos=new Map();
    eventos.forEach(e=>{
      const id=Number(e.id);
      if(Number.isFinite(id))eventosUnicos.set(id,{...e,id,eliminado:e.eliminado===true});
    });
    eventosActuales=[...eventosUnicos.values()];

    const fechasUnicas=new Map();
    fechas.forEach(f=>{
      const id=Number(f.id),eventoId=Number(f.evento_id);
      if(Number.isFinite(id)&&Number.isFinite(eventoId))fechasUnicas.set(id,{...f,id,evento_id:eventoId});
    });
    todasFechasEventos=[...fechasUnicas.values()];

    respuestasFechasUsuario=new Map();
    respuestas.forEach(r=>{
      const fechaId=Number(r.fecha_evento_id);
      if(Number.isFinite(fechaId)&&['si','no'].includes(r.respuesta))respuestasFechasUsuario.set(fechaId,r.respuesta);
    });

    calcularPendientesLocal();
    renderListaEventos();

    if(eventoActual){
      const e=eventosActuales.find(x=>Number(x.id)===Number(eventoActual.id));
      if(e)await seleccionarEvento(e.id);
    }
    return true;
  }catch(err){
    console.error('Error al cargar encuestas para el rol actual:',err);
    eventosActuales=[];todasFechasEventos=[];respuestasFechasUsuario=new Map();eventosPendientesIds=new Set();
    if(lista)lista.innerHTML='<div class="empty">⚠️ No se han podido cargar las encuestas. Vuelve a abrir Mis encuestas para reintentar.</div>';
    if(contador)contador.textContent='⚠️ No se han podido cargar las encuestas.';
    return false;
  }
}

/* Compatibilidad: estas funciones ya no hacen lecturas directas de tablas.
   Miembro, gestor y administrador usan el mismo RPC seguro. */
async function cargarEventos(){return eventosActuales}
async function cargarTodasFechasEventos(){return todasFechasEventos}
async function cargarRespuestasFechasUsuario(){return respuestasFechasUsuario}

function staHomeMarcar(btn){
  document.querySelectorAll('#menuInicio .sta-home-action').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
}
function staCambiarHomeMenu(tipo){
  const rapidos=document.getElementById('homePanelRapidos');
  const gestion=document.getElementById('homeGestion');
  const tRap=document.getElementById('homeTabRapidos');
  const tGes=document.getElementById('homeTabGestion');
  const esGestion=tipo==='gestion';
  rapidos?.classList.toggle('hidden',esGestion);
  gestion?.classList.toggle('hidden',!esGestion);
  tRap?.classList.toggle('active',!esGestion);
  tGes?.classList.toggle('active',esGestion);
  tRap?.setAttribute('aria-selected',esGestion?'false':'true');
  tGes?.setAttribute('aria-selected',esGestion?'true':'false');
}
let staPantallaInicioActiva=null;
function staMostrarNavPantallaInicio(id){
  const nav=document.getElementById('staFixedScreenNav');
  const title=document.getElementById('staFixedScreenTitle');
  if(!nav)return;
  const titulos={misEncuestas:'Mis encuestas',accesosSpirit:'Redes'};
  staPantallaInicioActiva=id;
  if(title)title.textContent=titulos[id]||'Spirit to All';
  nav.classList.add('visible');
  nav.setAttribute('aria-hidden','false');
}
function staOcultarNavPantallaInicio(){
  const nav=document.getElementById('staFixedScreenNav');
  nav?.classList.remove('visible');
  nav?.setAttribute('aria-hidden','true');
  staPantallaInicioActiva=null;
}
function staAbrirPantallaInicio(id){
  const el=document.getElementById(id);if(!el)return;
  cerrarPantallasHerramientas();
  document.querySelectorAll('.sta-standalone-screen').forEach(pantalla=>{
    if(pantalla!==el)pantalla.classList.remove('sta-standalone-screen');
  });
  el.classList.add('sta-standalone-screen');
  document.body.classList.add('sta-screen-open');
  document.documentElement.classList.add('sta-screen-open');
  el.scrollTop=0;
  if(id==='misEncuestas'||id==='accesosSpirit')staMostrarNavPantallaInicio(id);
}
function staCerrarPantallaActiva(){
  if(staPantallaInicioActiva){staCerrarPantallaInicio(staPantallaInicioActiva);return;}
  const abierta=document.querySelector('.sta-standalone-screen');
  if(abierta?.id)staCerrarPantallaInicio(abierta.id);
}
function staCerrarPantallaInicio(id){
  if(id==='misEncuestas'&&detalleEncuestaAbierto()){
    cerrarDetalleEncuestaVisual('inicio');
    limpiarEstadoDetalleHistoria();
    return;
  }
  document.getElementById(id)?.classList.remove('sta-standalone-screen');
  if(id===staPantallaInicioActiva)staOcultarNavPantallaInicio();
  if(!document.querySelector('.sta-standalone-screen')){document.body.classList.remove('sta-screen-open');document.documentElement.classList.remove('sta-screen-open');}
  staHomeMarcar(null);
  document.getElementById('menuInicio')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function staHomeVolverEncuestas(){
  staHomeMarcar(document.getElementById('homeMisEncuestas'));
  cambiarPestana('enCurso');
  staAbrirPantallaInicio('misEncuestas');
  // Actualizar estados de Supabase cada vez que se abre, incluso si cambiaron en otro móvil.
  await cargarTodo();
}
function staInicioAbrir(tipo,btn){
  if(staPermisosMenu[tipo]&&!staTienePermiso(staPermisosMenu[tipo]))return;
  staHomeMarcar(btn);
  if(tipo==='encuestas'){staHomeVolverEncuestas();return}
  if(tipo==='calendario'){abrirCalendario();return}
  if(tipo==='ayuda'){staColabAbrir();return}
   if(tipo==='material'){abrirMaterialCoro();return}
  if(tipo==='redes'){staAbrirPantallaInicio('accesosSpirit');cargarRedesSociales();return}
  if(tipo==='manual'){abrirManualUsuario();return}
  if(tipo==='seguridad'){abrirAvisoSeguridad(false);return}
  if(tipo==='produccion'){abrirProduccionEventos();return}
  if(tipo==='viabilidad'){abrirCentroViabilidad();return}
  if(tipo==='gestionEncuestas'){
    abrirGestionEncuestas();
    cambiarGestionPrincipal('administrar');
    cambiarAdministrarGestion('encuestas');
    return;
  }
  if(tipo==='gestionEnsayos'){abrirCalendario();return;}
  if(tipo==='dinero'){abrirPresupuestosDirecto();return}
  if(tipo==='whatsapp'){abrirPanelWhatsapp();return}
  if(tipo==='comercial'){abrirContactoComercial();return}
  if(tipo==='informes'){abrirCentroInformes();return}
  if(tipo==='usuarios'){abrirGestionUsuarios();return}
}

function obtenerFechasEvento(eventoId){
  const id=Number(eventoId);
  return todasFechasEventos
    .filter(f=>Number(f.evento_id)===id)
    .sort((a,b)=>{
      const oa=Number(a.orden??9999),ob=Number(b.orden??9999);
      if(oa!==ob)return oa-ob;
      return String(a.fecha||'').localeCompare(String(b.fecha||''))||String(a.hora||'').localeCompare(String(b.hora||''));
    });
}

function eventoTieneRespuestaPendiente(e){
  // Una encuesta solo requiere acción del miembro mientras esté ABIERTA.
  // Cuando el evento pasa a CONFIRMADO deja de pertenecer a Pendientes, aunque exista
  // alguna fecha sin respuesta. Así cada encuesta pertenece a una sola pestaña.
  if(!e||e.eliminado||e.estado!=='abierto')return false;
  const fechas=obtenerFechasEvento(e.id);
  return fechas.some(f=>!respuestasFechasUsuario.has(Number(f.id)));
}

function clasificarEventoUsuario(e){
  if(!e)return null;
  if(esEventoHistorico(e))return 'historial';
  if(e.estado==='confirmado'&&!e.eliminado)return 'confirmadas';
  if(e.estado==='abierto'&&!e.eliminado){
    return eventoTieneRespuestaPendiente(e)?'pendientes':'abiertas';
  }
  return null;
}

function calcularPendientesLocal(){
  const nuevosPendientes=new Set();
  eventosActuales.forEach(e=>{
    if(clasificarEventoUsuario(e)==='pendientes')nuevosPendientes.add(Number(e.id));
  });
  eventosPendientesIds=nuevosPendientes;
  const pendientes=eventosPendientesIds.size;
  const el=document.getElementById('contadorPendientes');
  const tarjeta=document.getElementById('tarjetaPendientes');
  if(el)el.textContent=pendientes===0?'✅ No tienes encuestas pendientes de responder.':pendientes===1?'⚠️ Tienes 1 encuesta pendiente de responder.':'⚠️ Tienes '+pendientes+' encuestas pendientes de responder.';
  if(tarjeta){
    tarjeta.classList.toggle('pendientes-activos',pendientes>0);
    tarjeta.classList.toggle('saludo-sin-pendientes',pendientes===0);
    tarjeta.setAttribute('aria-disabled',pendientes===0?'true':'false');
  }
}

async function actualizarContadorPendientes(){
  calcularPendientesLocal();
  if(['enCurso','pendientes','abiertas'].includes(pestanaActual))renderListaEventos();
}

function irAPendientes(){
  if(!eventosPendientesIds.size)return;
  staHomeMarcar(document.getElementById('homeMisEncuestas'));
  cambiarPestana('pendientes');
  staAbrirPantallaInicio('misEncuestas');
}

function cambiarPestana(nombre){
  document.getElementById('detalleEvento')?.classList.remove('sta-detalle-encuesta-screen');
  document.getElementById('detalleEvento')?.classList.add('hidden');
  ocultarNavGlobalDetalleEvento();
  limpiarEstadoDetalleHistoria();
  eventoActual=null;
  fechasEventoActual=[];
  fechaGestorSeleccionada=null;
  pestanaActual=nombre;
  ['EnCurso','Pendientes','Abiertas','Confirmadas','Historial'].forEach(x=>document.getElementById('tab'+x)?.classList.remove('activa'));
  const ids={enCurso:'tabEnCurso',pendientes:'tabPendientes',abiertas:'tabAbiertas',confirmadas:'tabConfirmadas',historial:'tabHistorial'};
  document.getElementById(ids[nombre]||'tabAbiertas')?.classList.add('activa');
  const herramientas=document.getElementById('historialHerramientas');
  herramientas?.classList.toggle('hidden',nombre!=='historial');
  if(nombre==='historial'){limiteHistorial=20;prepararAniosHistorial()}
  renderListaEventos();
}
function esEventoHistorico(e){return e?.eliminado===true||['cancelado','finalizado'].includes(e?.estado)}
function prepararAniosHistorial(){const sel=document.getElementById('anioHistorial');if(!sel)return;const actual=sel.value;const anios=[...new Set(eventosActuales.filter(e=>esEventoHistorico(e)&&e.fecha).map(e=>String(e.fecha).slice(0,4)))].sort((a,b)=>b.localeCompare(a));sel.innerHTML='<option value="">Todos los años</option>'+anios.map(a=>`<option value="${a}">${a}</option>`).join('');if(anios.includes(actual))sel.value=actual}
function normalizarBusquedaHistorial(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function historialFiltradoCompleto(){const q=normalizarBusquedaHistorial(document.getElementById('buscarHistorial')?.value),anio=document.getElementById('anioHistorial')?.value||'',estado=document.getElementById('estadoHistorial')?.value||'';return eventosActuales.filter(esEventoHistorico).filter(e=>{const estadoReal=e.eliminado?'eliminado':e.estado;if(estado&&estadoReal!==estado)return false;if(anio&&!String(e.fecha||'').startsWith(anio))return false;if(!q)return true;const fechaIso=String(e.fecha||''),fechaCorta=formatearFechaCorta(fechaIso),fechaSinCeros=fechaCorta.replace(/\b0/g,'');const bolsa=normalizarBusquedaHistorial([e.titulo,fechaIso,fechaCorta,fechaSinCeros,e.lugar,e.descripcion].join(' '));return bolsa.includes(q)}).sort((a,b)=>((b.fecha||'')+' '+(b.hora||'')).localeCompare((a.fecha||'')+' '+(a.hora||'')))}
function filtrarHistorial(){limiteHistorial=20;renderListaEventos()}
function verMasHistorial(){limiteHistorial+=20;renderListaEventos()}
function eventosDePestana(){
  if(pestanaActual==='enCurso')return eventosActuales.filter(e=>!e.eliminado&&['abierto','confirmado'].includes(e.estado));
  if(pestanaActual==='pendientes')return eventosActuales.filter(e=>clasificarEventoUsuario(e)==='pendientes');
  if(pestanaActual==='abiertas')return eventosActuales.filter(e=>clasificarEventoUsuario(e)==='abiertas');
  if(pestanaActual==='confirmadas')return eventosActuales.filter(e=>clasificarEventoUsuario(e)==='confirmadas');
  return historialFiltradoCompleto().slice(0,limiteHistorial);
}

function renderListaEventos(){
  const lista=document.getElementById('listaEventos'),eventos=eventosDePestana();
  if(!eventos.length){
    lista.innerHTML='<div class="empty">'+(pestanaActual==='pendientes'?'✅ No tienes encuestas pendientes de responder.':'No hay encuestas en esta sección.')+'</div>';
    document.getElementById('btnMasHistorial')?.classList.add('hidden');
    return;
  }
  lista.innerHTML=eventos.map(e=>{
    let badge;
    if(eventoTieneRespuestaPendiente(e)){
      badge='<span class="badge badge-por-responder">Pendiente</span>';
    }else{
      badge=e.eliminado?'<span class="badge badge-eliminada">🗑️ Eliminada</span>':
        e.estado==='abierto'?'<span class="badge badge-pendiente">Abierta</span>':
        e.estado==='confirmado'?'<span class="badge badge-confirmada">Confirmada</span>':
        e.estado==='cancelado'?'<span class="badge badge-cancelada">Cancelada</span>':
        '<span class="badge badge-finalizada">Finalizada</span>';
    }
    const sel=eventoActual&&eventoActual.id===e.id?' seleccionado':'';
    const accionesConfirmada=(['enCurso','confirmadas'].includes(pestanaActual)&&e.estado==='confirmado'&&!e.eliminado)
      ? `<div class="evento-acciones-directas">

           ${e.lugar?`<button type="button" class="evento-accion llegar-directo" onclick="event.stopPropagation();abrirComoLlegar(${escapeHtml(JSON.stringify(e.lugar))})">📍 Cómo llegar</button>`:''}
         </div>`
      : '';
    return `<div class="evento-item evento-item-interactivo${sel}" role="button" tabindex="0"
              onclick="seleccionarEvento(${e.id})"
              onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();seleccionarEvento(${e.id})}">
              <div class="evento-top">
                <div>
                  <div class="evento-titulo">${escapeHtml(e.titulo||'Evento')}</div>
                  <div class="muted">${formatearFechaCorta(e.fecha)} · ${formatearHora(e.hora)}</div>
                </div>
                ${badge}
              </div>
              ${accionesConfirmada}
            </div>`;
  }).join('');
  const btnMas=document.getElementById('btnMasHistorial');
  if(btnMas){
    const total=pestanaActual==='historial'?historialFiltradoCompleto().length:0;
    btnMas.classList.toggle('hidden',pestanaActual!=='historial'||eventos.length>=total);
    if(pestanaActual==='historial'&&eventos.length<total)btnMas.textContent=`Ver 20 más · ${eventos.length} de ${total}`;
  }
}

function detalleEncuestaAbierto(){
  const detalle=document.getElementById('detalleEvento');
  // El detalle se considera abierto siempre que sea visible. No dependemos de una clase
  // de presentación para que Atrás/Cerrar sigan funcionando en cualquier dispositivo.
  return !!detalle && !detalle.classList.contains('hidden');
}
function mostrarNavGlobalDetalleEvento(){
  const nav=document.getElementById('staEventDetailNav');
  const back=document.getElementById('staEventDetailBack');
  const title=document.getElementById('staEventDetailTitle');
  const desdeCalendario=origenDetalleEvento==='calendario';
  if(back){
    back.textContent=desdeCalendario?'‹ Calendario':'‹ Atrás';
    back.setAttribute('aria-label',desdeCalendario?'Volver al calendario':origenDetalleEvento==='proximos'?'Volver a Próximos eventos':'Volver a Mis encuestas');
  }
  if(title)title.textContent=(desdeCalendario||origenDetalleEvento==='proximos'||eventoActual?.estado==='confirmado')?'Detalle del evento':'Responder encuesta';
  nav?.classList.add('visible');
  nav?.setAttribute('aria-hidden','false');
  document.body.classList.add('sta-event-detail-open');
}
function ocultarNavGlobalDetalleEvento(){
  const nav=document.getElementById('staEventDetailNav');
  nav?.classList.remove('visible');
  nav?.setAttribute('aria-hidden','true');
  document.body.classList.remove('sta-event-detail-open');
}
function actualizarNavDetalleEvento(){
  const btn=document.getElementById('btnVolverDetalleEvento');
  const titulo=document.getElementById('tituloNavDetalleEvento');
  const desdeCalendario=origenDetalleEvento==='calendario';
  if(btn){
    btn.textContent=desdeCalendario?'‹ Calendario':'‹ Atrás';
    btn.setAttribute('aria-label',desdeCalendario?'Volver al calendario':origenDetalleEvento==='proximos'?'Volver a Próximos eventos':'Volver a Mis encuestas');
  }
  if(titulo)titulo.textContent=(desdeCalendario||origenDetalleEvento==='proximos'||eventoActual?.estado==='confirmado')?'Detalle del evento':'Responder encuesta';
  if(detalleEncuestaAbierto())mostrarNavGlobalDetalleEvento();
}
function cerrarDetalleEncuestaVisual(destino='lista'){
  const detalle=document.getElementById('detalleEvento');
  detalle?.classList.remove('sta-detalle-encuesta-screen','sta-confirmed-detail');
  detalle?.classList.add('hidden');
  ocultarNavGlobalDetalleEvento();
  eventoActual=null;
  fechasEventoActual=[];
  fechaGestorSeleccionada=null;
  renderListaEventos();
  if(destino==='calendario'){
    // Si el detalle se abrió desde Calendario, volvemos exactamente allí.
    document.getElementById('misEncuestas')?.classList.remove('sta-standalone-screen');
    if(staPantallaInicioActiva==='misEncuestas')staOcultarNavPantallaInicio();
    document.body.classList.remove('sta-screen-open');
    const panel=document.getElementById('panelCalendario');
    panel?.classList.remove('hidden');
    marcarNavActivo('panelCalendario');
    document.body.style.overflow='hidden';
    renderCalendario();
  }else if(destino==='inicio'||destino==='proximos'){
    document.getElementById('panelCalendario')?.classList.add('hidden');
    document.getElementById('misEncuestas')?.classList.remove('sta-standalone-screen');
    if(staPantallaInicioActiva==='misEncuestas')staOcultarNavPantallaInicio();
    if(!document.querySelector('.sta-standalone-screen')){document.body.classList.remove('sta-screen-open');document.documentElement.classList.remove('sta-screen-open');}
    marcarNavActivo();
    document.body.style.overflow='';
    staHomeMarcar(null);
    if(destino==='proximos')staAbrirProximosEventos(true);
    else document.getElementById('menuInicio')?.scrollIntoView({behavior:'auto',block:'start'});
  }else{
    document.getElementById('panelCalendario')?.classList.add('hidden');
    document.getElementById('misEncuestas')?.classList.add('sta-standalone-screen');
    document.body.classList.add('sta-screen-open');
    document.body.style.overflow='';
    staMostrarNavPantallaInicio('misEncuestas');
  }
}
function limpiarEstadoDetalleHistoria(){
  const st=history.state||{};
  if(st.staDetalleEvento){
    const nuevo={...st};delete nuevo.staDetalleEvento;delete nuevo.staVista;
    history.replaceState(nuevo,'',location.href);
  }
}
function cerrarDetalleEncuesta(){
  if(!detalleEncuestaAbierto())return;
  cerrarDetalleEncuestaVisual('inicio');
  limpiarEstadoDetalleHistoria();
  origenDetalleEvento='encuestas';
}
async function seleccionarEvento(id,origen=null){
  const idEvento=Number(id);
  if(origen)origenDetalleEvento=origen;
  else if(!detalleEncuestaAbierto()||Number(eventoActual?.id)!==idEvento)origenDetalleEvento='encuestas';
  const e=eventosActuales.find(x=>Number(x.id)===idEvento);if(!e)return;
  eventoActual=e;
  fechasEventoActual=obtenerFechasEvento(idEvento);
  fechaGestorSeleccionada=fechasEventoActual[0]?.id||null;

  // Abrimos primero la pantalla: no re-renderizamos toda la lista ni hacemos scroll animado.
  // En móvil esto evita el retardo perceptible y el detalle deja de quedar por debajo
  // de la pantalla fija de “Mis encuestas”.
  const detalle=document.getElementById('detalleEvento');
  detalle?.classList.remove('hidden');
  detalle?.classList.add('sta-detalle-encuesta-screen');
  actualizarNavDetalleEvento();
  mostrarNavGlobalDetalleEvento();
  if(detalle)detalle.scrollTop=0;
  if(!history.state?.staDetalleEvento){
    history.pushState({...history.state,staVista:'detalle_encuesta',staDetalleEvento:idEvento},'',location.href);
  }

  document.getElementById('tituloEvento').textContent=e.titulo||'Evento';
  document.getElementById('fechaEvento').textContent=fechasEventoActual.length>1?fechasEventoActual.length+' fechas':formatearFechaLarga(e.fecha);
  document.getElementById('horaEvento').textContent=fechasEventoActual.length>1?'Consulta cada sesión':formatearHora(e.hora);
  document.getElementById('lugarEvento').textContent=fechasEventoActual.length>1?'Varios / consultar sesiones':(e.lugar||'');
  document.getElementById('descripcionEvento').textContent=e.descripcion||'';
  document.getElementById('estadoEvento').textContent=e.eliminado?'🗑️ Encuesta eliminada':(({abierto:'🟠 Encuesta abierta',confirmado:'✅ Evento confirmado',cancelado:'❌ Evento cancelado',finalizado:'📁 Evento finalizado'})[e.estado]||e.estado);
  void staCargarDecisionVisible(idEvento);
  const esConfirmadoVisible=!e.eliminado&&e.estado==='confirmado';
  // Cambiar de encuesta nunca conserva los datos publicados de otra ficha.
  staInfoTecnicaPublicaCache.delete(idEvento);
  staVestuarioPublicoCache.delete(idEvento);
  detalle?.classList.toggle('sta-confirmed-detail',esConfirmadoVisible);
  document.getElementById('accionesConfirmadoEvento')?.classList.toggle('hidden',!esConfirmadoVisible);
  document.getElementById('zonaVotacion').classList.toggle('hidden',e.eliminado||!['abierto','confirmado'].includes(e.estado));
  document.getElementById('resumenDisponibilidadEvento')?.classList.toggle('hidden',esConfirmadoVisible&&fechasEventoActual.length===1);
  renderSesionesVotacion();

  const puedeEncuestas=staTienePermiso('encuestas');
  document.getElementById('accionesEstado')?.classList.toggle('hidden',!puedeEncuestas);
  document.getElementById('resumenGestor')?.classList.toggle('hidden',!puedeEncuestas);
  if(puedeEncuestas){
    document.getElementById('gestorEventoSeleccionado').textContent=e.titulo+' · '+(fechasEventoActual.length>1?fechasEventoActual.length+' fechas':formatearFechaCorta(e.fecha));
    document.getElementById('accionesEstado').classList.remove('hidden');
    document.getElementById('resumenGestor').classList.remove('hidden');
    cargarResumenFechasGestor().catch(err=>console.warn('Resumen gestor no disponible:',err));
    prepararMensajeWhatsapp();
  }
}

function volverALista(){
  if(!detalleEncuestaAbierto())return;
  const destino=origenDetalleEvento==='calendario'?'calendario':origenDetalleEvento==='proximos'?'proximos':'lista';
  if(history.state?.staDetalleEvento){
    history.back();
  }else{
    cerrarDetalleEncuestaVisual(destino);
    origenDetalleEvento='encuestas';
  }
}

window.addEventListener('popstate',()=>{
  const sheet=document.getElementById('staSheetBackdrop');
  const sheetBack=document.getElementById('staSheetBack');
  if(sheet&&!sheet.classList.contains('hidden')){
    if(staSheetHistory.length){
      volverStaSheet();
      const id=Number(eventoActual?.id||0);
      if(id&&!history.state?.staDetalleEvento)history.pushState({...history.state,staVista:'detalle_encuesta',staDetalleEvento:id},'',location.href);
      return;
    }
    if(sheetBack?.dataset.action==='event-detail'&&detalleEncuestaAbierto()){
      cerrarStaSheet();
      const id=Number(eventoActual?.id||0);
      if(id&&!history.state?.staDetalleEvento)history.pushState({...history.state,staVista:'detalle_encuesta',staDetalleEvento:id},'',location.href);
      return;
    }
    cerrarStaSheet();
    return;
  }
  if(detalleEncuestaAbierto()){
    const destino=origenDetalleEvento==='calendario'?'calendario':origenDetalleEvento==='proximos'?'proximos':'lista';
    cerrarDetalleEncuestaVisual(destino);
    origenDetalleEvento='encuestas';
    return;
  }
  if(staAtrasFisicoGestion())return;
});

function renderSesionesVotacion(){
  const zona=document.getElementById('sesionesVotacion');
  const editable=eventoActual&&['abierto','confirmado'].includes(eventoActual.estado);
  zona.innerHTML=(eventoActual?.estado==='confirmado'
    ?'<p class="muted">Puedes actualizar tu disponibilidad. Los cambios quedan registrados para la persona responsable de encuestas.</p>':'')+fechasEventoActual.map((f,i)=>{
    const r=respuestasFechasUsuario.get(Number(f.id));
    const clase=r==='si'?' respondida-si':r==='no'?' respondida-no':'';
    const respuesta=r==='si'?'✅ Tu respuesta: Sí, voy':r==='no'?'❌ Tu respuesta: No puedo':'⏳ Sin responder';
    return `<div class="sesion-voto${clase}"><div class="sesion-titulo">${fechasEventoActual.length>1?'Fecha '+(i+1)+' · ':''}${formatearFechaLarga(f.fecha)}</div><div class="muted">🕐 ${formatearHora(f.hora)}${f.lugar?' · 📍 '+escapeHtml(f.lugar):''}</div>${editable?`<div class="sesion-votacion"><button class="btn-yes" onclick="responderFecha(${f.id},'si')">✓ SÍ, VOY</button><button class="btn-no" onclick="responderFecha(${f.id},'no')">✕ NO PUEDO</button></div>`:''}<div class="sesion-respuesta">${respuesta}</div></div>`;
  }).join('')||'<p class="muted">Esta encuesta no tiene fechas configuradas.</p>';
  const respondidas=fechasEventoActual.filter(f=>respuestasFechasUsuario.has(Number(f.id))).length;
  document.getElementById('resumenMiDisponibilidad').textContent=fechasEventoActual.length?`${respondidas} de ${fechasEventoActual.length} fechas respondidas.`:'Sin fechas.';
}

async function responderFecha(fechaId,respuesta){
  if(!usuarioActual||!eventoActual||!['abierto','confirmado'].includes(eventoActual.estado))return;
  if(respuestasFechasUsuario.get(Number(fechaId))===respuesta)return;
  const botones=[...document.querySelectorAll('.sesion-votacion button')];
  botones.forEach(b=>b.disabled=true);
  try{
    const{error}=await supabaseClient.rpc('guardar_respuesta_encuesta',{p_fecha_evento_id:Number(fechaId),p_respuesta:respuesta});
    if(error)throw error;
    respuestasFechasUsuario.set(Number(fechaId),respuesta);
    renderSesionesVotacion();
    await actualizarContadorPendientes();
    if(esGestor())void cargarResumenFechasGestor().catch(error=>console.warn('Respuesta guardada. Error al actualizar el resumen:',error));
  }catch(err){
    console.error('Error guardando respuesta:',err);
    alert('No se ha podido guardar tu respuesta. Inténtalo de nuevo.');
  }finally{
    botones.forEach(b=>b.disabled=false);
  }
}

function anadirFechaCreacion(){
  contadorFechaCreacion++;
  const id=contadorFechaCreacion;
  const div=document.createElement('div');
  div.className='fecha-creacion';
  div.dataset.fechaId=id;
  div.innerHTML=`<div class="fecha-creacion-head"><strong>📅 Fecha ${document.querySelectorAll('.fecha-creacion').length+1}</strong>${document.querySelectorAll('.fecha-creacion').length?`<button type="button" class="btn-no btn-mini" onclick="quitarFechaCreacion(${id})">✕ Quitar</button>`:''}</div><input class="fecha-input" type="date"><input class="hora-input" type="time"><input class="lugar-input" type="text" placeholder="Lugar">`;
  document.getElementById('fechasCreacion').appendChild(div);
}

function quitarFechaCreacion(id){
  document.querySelector(`.fecha-creacion[data-fecha-id="${id}"]`)?.remove();
  renumerarFechasCreacion();
}

function renumerarFechasCreacion(){
  [...document.querySelectorAll('.fecha-creacion')].forEach((d,i)=>{
    const s=d.querySelector('.fecha-creacion-head strong');if(s)s.textContent='📅 Fecha '+(i+1);
  });
}

async function crearEvento(){
  if(!esGestor())return;
  const titulo=document.getElementById('nuevoTitulo').value.trim();
  const descripcion=document.getElementById('nuevaDescripcion').value.trim();
  const mensaje=document.getElementById('mensajeCrearEvento');
  const fechas=[...document.querySelectorAll('.fecha-creacion')].map(d=>({fecha:d.querySelector('.fecha-input').value,hora:d.querySelector('.hora-input').value,lugar:d.querySelector('.lugar-input').value.trim()}));
  if(!titulo){mensaje.textContent='⚠️ Escribe un título.';return}
  if(!fechas.length||fechas.some(f=>!f.fecha||!f.hora)){mensaje.textContent='⚠️ Todas las sesiones necesitan fecha y hora.';return}
  const boton=document.getElementById('btnCrearEvento');
  if(boton.disabled)return;
  boton.disabled=true;
  let creada=false;
  try{
    mensaje.textContent='Creando encuesta...';
    const{data,error}=await supabaseClient.rpc('crear_evento_multiple',{p_titulo:titulo,p_descripcion:descripcion||null,p_fechas:fechas});
    if(error){console.error(error);mensaje.textContent='❌ No se ha podido crear la encuesta. '+(error.message||'');return}
    creada=true;
    document.getElementById('nuevoTitulo').value='';
    document.getElementById('nuevaDescripcion').value='';
    document.getElementById('fechasCreacion').innerHTML='';
    anadirFechaCreacion();
    pestanaActual='abiertas';
    await cargarTodo();
    if(data){
      const eventoId=Number(data);
      await seleccionarEvento(eventoId);
      const resultado=await enviarNotificacionEvento(eventoId,'todos');
      mensaje.textContent=resultado.ok?(resultado.enviados>0?'✅ Encuesta creada y aviso enviado a '+resultado.enviados+' dispositivo(s).':'✅ Encuesta creada. '+(resultado.mensaje||'No hay dispositivos con notificaciones activadas.')):'✅ Encuesta creada. El aviso no se pudo enviar.';
    }else mensaje.textContent='✅ Encuesta creada correctamente.';
  }catch(error){
    console.error(error);
    mensaje.textContent=creada
      ? 'Encuesta creada. Vuelve a abrir la lista para comprobarla.'
      : 'No se ha podido confirmar la creación. Comprueba la lista antes de reintentar.';
  }finally{
    boton.disabled=false;
  }
}

async function enviarNotificacionEvento(eventoId,tipo){
  try{
    const {data,error}=await supabaseClient.functions.invoke('enviar-notificaciones',{body:{evento_id:eventoId,tipo}});
    if(error){console.error('Error invocando notificaciones:',error);return{ok:false,enviados:0,error:error.message||'Error'}}
    if(!data?.ok){console.error('Respuesta de notificaciones:',data);return{ok:false,enviados:0,error:data?.error||'Error'}}
    return{ok:true,enviados:data.enviados||0,mensaje:data.mensaje||''};
  }catch(error){console.error('Error enviando notificaciones:',error);return{ok:false,enviados:0,error:error?.message||'Error'}}
}
async function enviarRecordatorioPendientes(boton=document.getElementById('botonRecordatorio'),mensaje=document.getElementById('mensajeRecordatorio')){
  if(!esGestor()||!eventoActual)return;
  if(!['abierto','confirmado'].includes(eventoActual.estado)){alert('Esta encuesta ya no admite respuestas.');return}
  if(boton.disabled)return;
  const {id,titulo}=eventoActual;
  if(!confirm('¿Avisar a quienes tengan alguna fecha sin responder en "'+titulo+'"?'))return;
  boton.disabled=true;
  mensaje.textContent='Enviando recordatorio…';
  try{
    const resultado=await enviarNotificacionEvento(id,'pendientes');
    if(eventoActual?.id!==id)return;
    mensaje.textContent=resultado.ok
      ? (resultado.enviados===0
        ? (resultado.mensaje||'No hay dispositivos pendientes con notificaciones activadas a los que avisar.')
        : '✅ Recordatorio enviado a '+resultado.enviados+' dispositivo(s).')
      : '❌ No se ha podido enviar el recordatorio.';
    if(resultado.ok){
      await cargarEstadosNotificaciones();
      if(esAdmin()){actualizarResumenUsuarios();renderGestionUsuarios()};
      if(eventoActual?.id===id&&!document.getElementById('listaPendientes').classList.contains('hidden'))await cargarPendientesFecha();
    }
  }finally{
    boton.disabled=false;
  }
}
async function staRetirarEvento(id,tipo){
  const {data,error}=await supabaseClient.functions.invoke('enviar-notificaciones',{body:{tipo,evento_id:id}});
  if(error||!data?.guardado){
    alert('No se pudo confirmar el cambio. Actualiza la lista antes de volver a intentarlo.');
    return false;
  }
  const avisados=Number(data.enviados||0);
  const fallidos=Number(data.fallidos||0);
  if(data.aviso_fallido||fallidos){
    alert('Evento guardado. Avisos enviados a '+avisados+' dispositivos. No se pudo completar el envío.');
  }else if(!data.aviso_omitido){
    alert(avisados?'Aviso enviado a '+avisados+' dispositivos.':'Evento guardado. No había dispositivos a los que avisar.');
  }
  return true;
}
async function eliminarEventoActual(){
  if(!staTienePermiso('encuestas')||!eventoActual)return;
  const titulo=eventoActual.titulo||'esta encuesta';
  if(!confirm('¿Mover "'+titulo+'" al histórico como ELIMINADA?\n\nDejará de aparecer en encuestas activas, calendario y WhatsApp, pero conservaremos sus fechas y respuestas.'))return;
  const id=eventoActual.id;
  if(!await staRetirarEvento(id,'eliminar_evento'))return;
  await cargarTodo();
  eventoActual=eventosActuales.find(e=>Number(e.id)===Number(id))||null;
  pestanaActual='historial';cambiarPestana('historial');
  if(eventoActual)await seleccionarEvento(id);
  cargarSelectorGestionEventos();
}

async function cambiarEstadoActual(nuevoEstado){
  if(!staTienePermiso('encuestas')||!eventoActual)return;
  if(eventoActual.eliminado){alert('Una encuesta eliminada queda solo como histórico.');return}
  const nombres={confirmado:'confirmar',cancelado:'cancelar',finalizado:'finalizar',abierto:'reabrir'};
  if(!confirm('¿Quieres '+(nombres[nuevoEstado]||'cambiar')+' la encuesta "'+eventoActual.titulo+'"?'))return;
  const id=Number(eventoActual.id);
  if(nuevoEstado==='cancelado'){
    if(!await staRetirarEvento(id,'cancelar_evento'))return;
  }else{
    const{error}=await supabaseClient.rpc('cambiar_estado_evento',{p_evento_id:id,p_estado:nuevoEstado});
    if(error){console.error(error);alert('No se ha podido cambiar el estado.');return}
  }
  // cargarEventos() es una función de compatibilidad que NO consulta Supabase.
  // Recargar el RPC real para evitar la encuesta confirmada visible en «Abiertas».
  eventoActual=null;
  const actualizado=await cargarTodo();
  if(!actualizado){
    // El guardado se realizó, pero la lectura posterior falló: informar sin fingir éxito visual.
    alert('El estado se ha guardado, pero no se ha podido refrescar la lista. Vuelve a abrir Mis encuestas.');
    return;
  }
  const guardado=eventosActuales.find(e=>Number(e.id)===id);
  if(!guardado){alert('El estado se guardó, pero la encuesta no aparece en la nueva consulta. Actualiza la pantalla.');return;}
  const destino=clasificarEventoUsuario(guardado)||'abiertas';
  cambiarPestana(destino);
  calcularPendientesLocal();
  if(typeof cargarSelectorGestionEventos==='function')cargarSelectorGestionEventos();
  await seleccionarEvento(id);
  document.getElementById('listaEventos')?.setAttribute('data-ultima-actualizacion',new Date().toISOString());
}

function abrirViabilidadGestion(){
  if(!eventoActual)return;
  const fechas=(fechasEventoActual||[]).filter(f=>f&&f.id!=null);
  if(!fechas.length){
    alert('Esta encuesta todavía no tiene fechas para consultar las respuestas.');
    return;
  }
  const fecha=fechas.find(f=>Number(f.id)===Number(fechaGestorSeleccionada))||fechas[0];
  void seleccionarFechaGestor(Number(fecha.id));
}

let staPendientesEventoResumen=[];
function actualizarPendientesEventoDestacado(rows=[]){
  staPendientesEventoResumen=Array.isArray(rows)?rows:[];
  const card=document.getElementById('gestionPendientesDestacado');
  if(!card)return;
  const activo=!!(eventoActual&&!eventoActual.eliminado&&['abierto','confirmado'].includes(eventoActual.estado));
  if(!activo){card.classList.add('hidden');return}
  const conPendientes=staPendientesEventoResumen.filter(r=>Number(r.pendientes||0)>0);
  const total=conPendientes.reduce((n,r)=>n+Number(r.pendientes||0),0);
  const titulo=document.getElementById('gestionPendientesTitulo');
  const subtitulo=document.getElementById('gestionPendientesSubtitulo');
  const numero=document.getElementById('gestionPendientesNumero');
  const abrir=document.getElementById('gestionPendientesAbrirBtn');
  const recordar=document.getElementById('gestionPendientesRecordarBtn');
  card.classList.remove('hidden');
  card.classList.toggle('resuelto',total===0);
  if(titulo)titulo.textContent=total===0?'✅ Todo el mundo ha respondido':'⏳ Pendientes de responder';
  if(subtitulo){
    if(total===0)subtitulo.textContent='No hay respuestas pendientes en esta encuesta.';
    else if(staPendientesEventoResumen.length===1)subtitulo.textContent=`${total===1?'1 persona pendiente':`${total} personas pendientes`} · pulsa para ver quién falta`;
    else subtitulo.textContent=`${total} respuestas pendientes repartidas en ${conPendientes.length} fecha${conPendientes.length===1?'':'s'}`;
  }
  if(numero)numero.textContent=String(total);
  if(abrir)abrir.disabled=total===0;
  if(recordar)recordar.disabled=total===0;
}

function abrirPendientesEventoDestacado(){
  const rows=(staPendientesEventoResumen||[]).filter(r=>Number(r.pendientes||0)>0);
  if(!rows.length)return;
  if(rows.length===1){
    fechaGestorSeleccionada=Number(rows[0].fecha_evento_id);
    staPendientesTotal=Number(rows[0].pendientes||0);
    abrirPendientesRapido();
    return;
  }
  const total=rows.reduce((n,r)=>n+Number(r.pendientes||0),0);
  const lista=rows.map(r=>`<button class="sta-pending-date-row" type="button" onclick="abrirPendientesFechaDestacada(${Number(r.fecha_evento_id)},${Number(r.pendientes||0)})"><span><strong>${escapeHtml(formatearFechaCorta(r.fecha||''))}${r.hora?' · '+escapeHtml(formatearHora(r.hora)):''}</strong><small>${r.lugar?escapeHtml(r.lugar)+' · ':''}${Number(r.pendientes||0)} pendiente${Number(r.pendientes||0)===1?'':'s'}</small></span><b>›</b></button>`).join('');
  abrirStaSheet('Pendientes de responder',`<div class="sta-sheet-intro"><strong>⏳ ${total} respuestas pendientes</strong><p>Elige una fecha para ver exactamente quién falta. El recordatorio general avisa a las personas que todavía tengan alguna respuesta pendiente en esta encuesta.</p></div><div class="sta-pending-date-list">${lista}</div><div class="sta-sheet-actions"><button class="sta-action-primary" type="button" onclick="recordarPendientesEventoDestacado()">🔔 Recordar a todos los pendientes</button></div>`);
}

async function abrirPendientesFechaDestacada(fechaId,total){
  fechaGestorSeleccionada=Number(fechaId);
  staPendientesTotal=Number(total||0);
  await mostrarListaPendientesSheet();
}

async function recordarPendientesEventoDestacado(){
  if(!esGestor()||!eventoActual)return;
  const total=(staPendientesEventoResumen||[]).reduce((n,r)=>n+Number(r.pendientes||0),0);
  if(total<=0)return;
  if(!['abierto','confirmado'].includes(eventoActual.estado)){alert('Esta encuesta ya no admite recordatorios.');return}
  if(!confirm(`¿Enviar un recordatorio a quienes todavía tengan respuestas pendientes en “${eventoActual.titulo}”?`))return;
  const btn=document.getElementById('gestionPendientesRecordarBtn');
  const msg=document.getElementById('gestionPendientesMensaje');
  if(btn){btn.disabled=true;btn.textContent='Enviando…'}
  if(msg)msg.textContent='Enviando recordatorio…';
  try{
    const resultado=await enviarNotificacionEvento(eventoActual.id,'pendientes');
    if(msg)msg.textContent=resultado.ok?(resultado.enviados===0?'✅ No hay dispositivos pendientes con notificaciones activadas.':`✅ Recordatorio enviado a ${resultado.enviados} dispositivo(s).`):'❌ No se ha podido enviar el recordatorio.';
    if(resultado.ok){await cargarEstadosNotificaciones();if(esAdmin()){actualizarResumenUsuarios();renderGestionUsuarios()};await cargarResumenFechasGestor()}
  }catch(e){console.error(e);if(msg)msg.textContent='❌ No se ha podido enviar el recordatorio.'}
  finally{if(btn){const quedan=(staPendientesEventoResumen||[]).reduce((n,r)=>n+Number(r.pendientes||0),0);btn.disabled=quedan<=0;btn.textContent='🔔 Recordar ahora'}}
}

async function cargarResumenFechasGestor(){
  if(!esGestor()||!eventoActual)return;
  const eventoId=eventoActual.id;
  const{data,error}=await supabaseClient.rpc('resumen_fechas_evento',{p_evento_id:eventoId});
  if(eventoActual?.id!==eventoId)return;
  if(error){
    console.error(error);
    document.getElementById('resumenFechasGestor').textContent='No se han podido actualizar los resultados. Vuelve a intentarlo.';
    return;
  }
  const arr=data||[];
  actualizarPendientesEventoDestacado(arr);
  document.getElementById('resumenFechasGestor').innerHTML=arr.map((f,i)=>`<button class="resumen-fecha-btn sta-viability-date-card" onclick="seleccionarFechaGestor(${f.fecha_evento_id})"><span class="sta-viability-date-main"><strong>${arr.length>1?'Fecha '+(i+1)+' · ':''}${formatearFechaCorta(f.fecha)} · ${formatearHora(f.hora)}</strong><span class="muted">${f.lugar?escapeHtml(f.lugar)+' · ':''}✅ ${f.van} · ❌ ${f.no_van} · ⏳ ${f.pendientes}</span></span><span class="sta-viability-date-cta"><span>🎯 Viabilidad</span><b>›</b></span></button>`).join('')||'<p class="muted">Sin fechas.</p>';
  if(arr.length){
    if(!arr.some(f=>Number(f.fecha_evento_id)===Number(fechaGestorSeleccionada)))fechaGestorSeleccionada=Number(arr[0].fecha_evento_id);
    if(gestionVistaEncuestas==='fecha')await seleccionarFechaGestor(fechaGestorSeleccionada,false);
  }
}

function staFechasOpciones(){
  return fechasEventoActual.map(fecha=>`<option value="${Number(fecha.id)}">${escapeHtml([formatearFechaCorta(fecha.fecha),formatearHora(fecha.hora),fecha.lugar].filter(Boolean).join(' · '))}</option>`).join('');
}

async function seleccionarFechaGestor(fechaId,scroll=true){
  const eventoId=Number(eventoActual?.id);
  const fecha=fechasEventoActual.find(x=>Number(x.id)===fechaId);
  if(!eventoId||!fecha)return;
  fechaGestorSeleccionada=fechaId;
  const selector=document.getElementById('staFechaViabilidad');
  selector.innerHTML=staFechasOpciones();
  selector.value=String(fechaId);
  document.getElementById('staFechaViabilidadLabel').classList.toggle('hidden',fechasEventoActual.length<2);
  const titulo=document.getElementById('tituloDetalleFecha');
  titulo.classList.toggle('hidden',fechasEventoActual.length>1);
  titulo.textContent=[formatearFechaLarga(fecha.fecha),formatearHora(fecha.hora),fecha.lugar].filter(Boolean).join(' · ');
  if(gestionVistaEncuestas!=='fecha')mostrarVistaGestionEncuestas('fecha');
  if(scroll)document.getElementById('detalleFechaGestor')?.scrollIntoView({block:'nearest'});
  await Promise.all([cargarResumenCuerdasFecha(fechaId),staCargarDecisionGestion(eventoId)]);
}

async function cargarResumenCuerdasFecha(fechaId){
  const recordatorio=document.getElementById('staRecordatorioViabilidad');
  recordatorio.classList.add('hidden');
  const caja=document.getElementById('viabilidadEvento');
  caja.className='viabilidad-box sta-compact';
  caja.innerHTML='<p role="status">Cargando respuestas…</p>';
  const {data,error}=await supabaseClient.rpc('sta_respuestas_viabilidad',{p_fecha_evento_id:fechaId});
  if(Number(fechaGestorSeleccionada)!==fechaId)return;
  if(error){
    caja.innerHTML=`<p role="alert">No se han podido cargar las respuestas.</p><button type="button" class="btn-light" onclick="cargarResumenCuerdasFecha(${fechaId})">Reintentar</button>`;
    return;
  }
  const personas=data||[];
  staMostrarDisponibilidad(personas);
  const eventoId=Number(eventoActual?.id);
  if(!esGestor()||!staTienePermiso('encuestas')||!['abierto','confirmado'].includes(eventoActual?.estado))return;
  if(personas.some(p=>p.respuesta==='pendiente')){
    recordatorio.classList.remove('hidden');
    return;
  }
  if(fechasEventoActual.length<2)return;
  const resumen=await supabaseClient.rpc('resumen_fechas_evento',{p_evento_id:eventoId});
  if(Number(eventoActual?.id)!==eventoId||Number(fechaGestorSeleccionada)!==fechaId||resumen.error)return;
  recordatorio.classList.toggle('hidden',!(resumen.data||[]).some(f=>Number(f.pendientes)>0));
}

function staMostrarDisponibilidad(personas){
  const caja=document.getElementById('viabilidadEvento');
  const orden=[...personas].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es',{sensitivity:'base'}));
  const estados=[['si','Pueden'],['no','No pueden'],['pendiente','Sin responder']];
  const estado=p=>p.respuesta==='si'||p.respuesta==='no'?p.respuesta:'pendiente';
  const totales=estados.map(([id,titulo])=>{
    const cantidad=orden.filter(p=>estado(p)===id).length;
    return `<div class="sta-resultado-${id}"><dt>${titulo}</dt><dd>${cantidad}</dd></div>`;
  }).join('');
  const porCuerda=new Map(CUERDAS.map(c=>[c.id,{nombre:c.nombre,integrantes:[]}]));
  const sinCuerda={nombre:'Sin cuerda asignada',integrantes:[]};
  for(const persona of orden){
    (porCuerda.get(Number(persona.cuerda_id))||sinCuerda).integrantes.push(persona);
  }
  const nombre=p=>{
    const id=estado(p);
    const respuesta=estados.find(([clave])=>clave===id)[1];
    const roles=[p.puede_dirigir?'Dirección':'',Number(p.cuerda_id)===7?etiquetaInstrumento(p.instrumento):'',p.es_solista?'Solista':''].filter(Boolean).join(' · ');
    return `<li><div><strong>${escapeHtml(p.nombre||'Sin nombre')}</strong>${roles?`<small>${escapeHtml(roles)}</small>`:''}</div><span class="sta-resultados-respuesta sta-resultado-${id}">${respuesta}</span></li>`;
  };
  const detalle=[...porCuerda.values(),sinCuerda].filter(c=>c.integrantes.length).map(c=>
    `<section class="sta-resultados-grupo"><h5>${escapeHtml(c.nombre)}</h5><ul>${c.integrantes.map(nombre).join('')}</ul></section>`
  ).join('');
  caja.innerHTML=`<h4 class="sta-resultados-titulo">Resumen de respuestas</h4><dl class="sta-resultados-totales" aria-label="Resumen de respuestas">${totales}</dl>${detalle?`<details class="sta-resultados-detalle"><summary>Ver nombres</summary>${detalle}</details>`:''}<div class="sta-viabilidad-export"><button type="button" class="btn-light" onclick="staExportarViabilidadExcel(this)">⬇️ Exportar a Excel</button><small>Incluye todas las fechas del evento y las respuestas actuales. Genera otra copia para ver cambios posteriores.</small></div>`;
}

async function staExportarViabilidadExcel(boton){
  if(!esGestor()||!staTienePermiso('viabilidad')||boton?.disabled)return;
  const evento=eventoActual,fechas=[...fechasEventoActual];
  if(!evento||!['abierto','confirmado'].includes(evento.estado)||!fechas.length)return;
  boton.disabled=true;const original=boton.textContent;boton.textContent='Preparando Excel…';
  try{
    // Se vuelve a consultar el servidor: nunca se exporta una copia antigua del desglose en pantalla.
    const respuestas=await Promise.all(fechas.map(async f=>{
      const {data,error}=await supabaseClient.rpc('sta_respuestas_viabilidad',{p_fecha_evento_id:Number(f.id)});
      if(error)throw error;
      const personas=Array.isArray(data)?data:[];
      if(new Set(personas.map(p=>p.usuario_id)).size!==personas.length)throw new Error('Hay personas duplicadas en el resultado. Revisa la encuesta antes de exportar.');
      return{fecha:f,personas};
    }));
    if(eventoActual?.id!==evento.id)throw new Error('Has cambiado de evento. Vuelve a pulsar exportar.');
    const wb=await staExcelNuevoLibro();wb.calcProperties.fullCalcOnLoad=true;
    const generado=new Date().toLocaleString('es-ES');
    const detalle=wb.addWorksheet('Respuestas',{properties:{tabColor:{argb:staExcelArgb(STA_XLSX.orange)}}});
    staExcelConfigHoja(detalle);
    staExcelTitulo(detalle,'SPIRIT TO ALL · DISPONIBILIDAD',`${evento.titulo} · Datos consultados: ${generado}`,'J');
    const cabecera=detalle.getRow(4);cabecera.values=['Fecha','Evento','Nombre','Cuerda','Instrumento','Respuesta','Solista','Dirección','Hora del bolo','Lugar'];staExcelCabecera(cabecera);
    let total=0;
    respuestas.forEach(({fecha,personas})=>{
      [...personas].sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es')).forEach(p=>{
        const estado=p.respuesta==='si'?'Sí':p.respuesta==='no'?'No':'Sin responder';
        const row=detalle.addRow([String(fecha.fecha||''),evento.titulo,p.nombre||'',staCuerdaNombre(p.cuerda_id),p.instrumento?etiquetaInstrumento(p.instrumento):'',estado,p.es_solista?'Sí':'No',p.puede_dirigir?'Sí':'No',formatearHora(fecha.hora),fecha.lugar||'']);
        staExcelFila(row,total++);
        const celda=row.getCell(6);celda.font={name:'Aptos',size:10,bold:true,color:{argb:staExcelArgb(estado==='Sí'?STA_XLSX.greenText:estado==='No'?STA_XLSX.redText:STA_XLSX.grayText)}};
        celda.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(estado==='Sí'?STA_XLSX.green:estado==='No'?STA_XLSX.red:STA_XLSX.light)}};
      });
    });
    [15,35,29,19,19,19,11,13,16,33].forEach((w,i)=>detalle.getColumn(i+1).width=w);
    detalle.views=[{state:'frozen',ySplit:4,showGridLines:false}];
    detalle.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,4+total),column:10}};
    const resumen=wb.addWorksheet('Resumen',{properties:{tabColor:{argb:staExcelArgb(STA_XLSX.black)}}});staExcelConfigHoja(resumen);
    staExcelTitulo(resumen,'SPIRIT TO ALL · VIABILIDAD',`${evento.titulo} · Exportado: ${generado} · Archivo no conectado a la app`,'G');
    const cab= resumen.getRow(4);cab.values=['Fecha','Hora','Lugar','Personas','Sí','No','Sin responder'];staExcelCabecera(cab);
    const final=4+total;
    respuestas.forEach(({fecha,personas},i)=>{
      const num=5+i,si=personas.filter(p=>p.respuesta==='si').length,no=personas.filter(p=>p.respuesta==='no').length,pend=personas.length-si-no;
      const row=resumen.getRow(num);row.values=[String(fecha.fecha||''),formatearHora(fecha.hora),fecha.lugar||'',personas.length,
        {formula:`COUNTIFS(Respuestas!$A$5:$A$${final},A${num},Respuestas!$F$5:$F$${final},"Sí")`,result:si},
        {formula:`COUNTIFS(Respuestas!$A$5:$A$${final},A${num},Respuestas!$F$5:$F$${final},"No")`,result:no},
        {formula:`COUNTIFS(Respuestas!$A$5:$A$${final},A${num},Respuestas!$F$5:$F$${final},"Sin responder")`,result:pend}];staExcelFila(row,i);
    });
    [17,15,37,14,13,13,20].forEach((w,i)=>resumen.getColumn(i+1).width=w);
    resumen.views=[{state:'frozen',ySplit:4,showGridLines:false}];
    resumen.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,4+respuestas.length),column:7}};
    const bytes=await staExcelBytes(wb);
    await staGuardarBlobCompatible(new Blob([bytes],{type:STA_XLSX_MIME}),`Spirit_Viabilidad_${staNombreArchivo(evento.titulo)}_${new Date().toISOString().slice(0,10)}.xlsx`,{selectorArchivo:true});
  }catch(error){console.error('Error exportando viabilidad:',error);alert('No se pudo exportar la viabilidad. '+(error?.message||'Inténtalo de nuevo.'))}
  finally{boton.disabled=false;boton.textContent=original}
}

const staDecisionesEnCurso=new Set();
const staTextoDecision={viable:'Viable',no_viable:'No viable'};

async function staConsultarDecision(eventoId){
  const {data,error}=await supabaseClient.functions.invoke('enviar-notificaciones',{body:{tipo:'consultar_viabilidad',evento_id:eventoId}});
  if(error||!data?.ok)throw error||new Error('Decisión no disponible');
  return data;
}

async function staCargarDecisionVisible(eventoId){
  const caja=document.getElementById('staDecisionVisible');
  caja.classList.add('hidden');
  if(eventoActual?.eliminado)return;
  try{
    const {decision}=await staConsultarDecision(eventoId);
    if(Number(eventoActual?.id)!==eventoId||!staTextoDecision[decision])return;
    caja.textContent='Valoración de Dirección · '+staTextoDecision[decision];
    caja.classList.remove('hidden');
  }catch(error){console.warn('Decisión de Dirección no disponible:',error)}
}

function staPintarDecision(eventoId,decision,puedePublicar,mensaje='',puedeReintentar=false){
  const caja=document.getElementById('staDecisionViabilidad');
  caja.innerHTML=`<div class="sta-decision-cabecera"><h4>Decisión de Dirección</h4>
    <span class="sta-decision-estado sta-decision-${staTextoDecision[decision]?decision:'pendiente'}">${staTextoDecision[decision]||'Pendiente de valorar'}</span></div>
    ${puedePublicar?`<button type="button" class="btn-primary sta-decision-publicar" onclick="staAbrirDecision(${eventoId},this)">${decision?'Cambiar decisión':'Publicar decisión'}</button>`:
      '<p class="muted sta-decision-mensaje">Solo Dirección puede publicar la decisión desde su cuenta.</p>'}
    ${!decision&&esAdmin()?`<button type="button" class="btn-light btn-full" onclick="staAvisarLuisViabilidad(${eventoId},this)">🔔 Avisar solo a Luis para revisar viabilidad</button><small class="muted">Disponible al quedar 10 personas o menos por responder. Un aviso por encuesta.</small>`:''}
    ${puedePublicar&&puedeReintentar?`<button type="button" class="btn-light" onclick="staPublicarDecision(${eventoId},null,true)">Reintentar avisos fallidos</button>`:''}
    <p class="muted sta-decision-mensaje"${mensaje?'':' hidden'}>${escapeHtml(mensaje)}</p>`;
  caja.dataset.decision=decision||'';
}

async function staAvisarLuisViabilidad(eventoId,boton){
  if(!esAdmin()||!boton||boton.disabled)return;
  boton.disabled=true;const original=boton.textContent;boton.textContent='Comprobando respuestas…';
  try{
    const {data,error}=await supabaseClient.functions.invoke('avisar-viabilidad-luis',{body:{evento_id:Number(eventoId)}});
    if(error||!data?.ok)throw new Error(data?.error||error?.message||'No se pudo enviar el aviso.');
    boton.textContent=data.duplicado?'Ya se avisó a Luis por esta encuesta':data.enviados?`✅ Aviso enviado solo a Luis · ${data.pendientes} pendientes`:'No se pudo entregar el aviso a Luis';
    if(!data.enviados&&!data.duplicado)boton.disabled=false;
  }catch(e){boton.textContent=original;boton.disabled=false;alert('No se envió el aviso: '+(e.message||'Error desconocido'))}
}

async function staCargarDecisionGestion(eventoId){
  const caja=document.getElementById('staDecisionViabilidad');
  if(staDecisionesEnCurso.has(eventoId)&&caja.dataset.evento===String(eventoId))return;
  caja.dataset.evento=String(eventoId);
  caja.textContent='Cargando decisión de Dirección…';
  try{
    const {decision,puede_publicar,puede_reintentar}=await staConsultarDecision(eventoId);
    if(Number(eventoActual?.id)!==eventoId||staDecisionesEnCurso.has(eventoId))return;
    staPintarDecision(eventoId,decision,puede_publicar,'',puede_reintentar);
  }catch(error){
    if(Number(eventoActual?.id)===eventoId)caja.innerHTML=`<p>No se ha podido consultar la decisión.</p><button type="button" class="btn-light" onclick="staCargarDecisionGestion(${eventoId})">Reintentar</button>`;
  }
}

function staAbrirDecision(eventoId,boton){
  if(Number(eventoActual?.id)!==eventoId||staDecisionesEnCurso.has(eventoId))return;
  const dialog=document.getElementById('staDecisionDialog');
  dialog.dataset.evento=String(eventoId);
  dialog.querySelector('select').value=boton.closest('#staDecisionViabilidad').dataset.decision||'';
  dialog.showModal();
}

function staConfirmarDecision(form){
  const dialog=form.closest('dialog');
  const eventoId=Number(dialog.dataset.evento);
  const decision=form.elements.decision.value;
  dialog.close();
  if(decision)void staPublicarDecision(eventoId,decision);
}

async function staPublicarDecision(eventoId,decision,reintento=false){
  if(Number(eventoActual?.id)!==eventoId||staDecisionesEnCurso.has(eventoId))return;
  const caja=document.getElementById('staDecisionViabilidad');
  const anterior=caja.dataset.decision||null;
  if(!reintento&&decision===anterior)return;
  const mensaje=caja.querySelector('.sta-decision-mensaje');
  mensaje.hidden=false;
  staDecisionesEnCurso.add(eventoId);
  caja.querySelectorAll('button').forEach(b=>b.disabled=true);
  mensaje.textContent=reintento?'Reintentando avisos…':'Publicando…';
  try{
    const {data,error}=await supabaseClient.functions.invoke('enviar-notificaciones',{
      body:{tipo:reintento?'reintentar_aviso_viabilidad':'publicar_viabilidad',evento_id:eventoId,decision,decision_anterior:anterior}
    });
    if(error||!data?.ok)throw error||new Error('Publicación no confirmada');
    if(Number(eventoActual?.id)!==eventoId)return;
    const aviso=data.aviso_omitido?'La decisión ya estaba publicada.':
      data.aviso_fallido?'Decisión publicada. No se pudo enviar el aviso.':
      data.fallidos?`Decisión publicada. Avisos enviados: ${data.enviados}. Fallidos: ${data.fallidos}.`:
      data.enviados?`Decisión publicada. Aviso enviado a ${data.enviados} dispositivo(s).`:
      'Decisión publicada. No había dispositivos con avisos activados.';
    const mensajeFinal=reintento&&!data.aviso_fallido
      ? `Avisos reenviados: ${Number(data.enviados||0)}. Fallidos: ${Number(data.fallidos||0)}.` : aviso;
    staPintarDecision(eventoId,data.decision,true,mensajeFinal,Boolean(data.puede_reintentar));
    if(data.evento_confirmado){
      try{
        const actualizado=await cargarTodo();
        if(actualizado){
          eventoActual=eventosActuales.find(e=>Number(e.id)===eventoId)||eventoActual;
          if(typeof cargarSelectorGestionEventos==='function')cargarSelectorGestionEventos();
        }
      }catch(error){console.warn('Decisión guardada; refresca la lista para ver la confirmación:',error)}
    }
  }catch(error){
    console.warn('Publicación no confirmada:',error);
    if(Number(eventoActual?.id)===eventoId){
      staPintarDecision(eventoId,anterior,false,'No se pudo confirmar la publicación.');
      const consultar=document.createElement('button');
      consultar.type='button';consultar.className='btn-light';consultar.textContent='Consultar estado';
      consultar.onclick=()=>staCargarDecisionGestion(eventoId);
      caja.append(consultar);
    }
  }finally{
    staDecisionesEnCurso.delete(eventoId);
  }
}

function actualizarPendientesViabilidad(total){
  const n=Number(total||0);
  const conteo=document.getElementById('conteoPendientesViabilidad');
  const titulo=document.getElementById('tituloPendientesViabilidad');
  const ver=document.getElementById('botonPendientes');
  const recordar=document.getElementById('botonRecordatorio');
  if(conteo)conteo.textContent=n===1?'1 persona':`${n} personas`;
  if(titulo)titulo.textContent=n===0?'✅ Todo el mundo ha respondido':'⏳ Pendientes de responder';
  if(ver){ver.disabled=n===0;ver.textContent=n===0?'✅ Sin pendientes':'👥 Ver quién falta'}
  if(recordar)recordar.disabled=n===0;
}

function cerrarDetallesViabilidad(){
  document.querySelectorAll('#viabilidadEvento .viabilidad-row.abierta').forEach(el=>el.classList.remove('abierta'));
  document.querySelectorAll('#viabilidadEvento .viabilidad-group.abierta').forEach(el=>el.classList.remove('abierta'));
}



function togglePendientes(){
  if(!fechaGestorSeleccionada)return;
  const lista=document.getElementById('listaPendientes'),boton=document.getElementById('botonPendientes');
  if(lista.classList.contains('hidden')){lista.classList.remove('hidden');boton.textContent='🔼 Ocultar pendientes';cargarPendientesFecha()}
  else{lista.classList.add('hidden');boton.textContent='👥 Ver quién falta por responder'}
}

async function cargarPendientesFecha(){
  if(!esGestor()||!fechaGestorSeleccionada)return;
  const{data,error}=await supabaseClient.rpc('pendientes_fecha_evento',{p_fecha_evento_id:fechaGestorSeleccionada});
  if(error){console.error(error);return}
  await cargarEstadosNotificaciones();
  document.getElementById('listaPendientes').innerHTML=!data||!data.length?'<p>✅ Todo el mundo ha respondido a esta fecha.</p>':data.map(p=>`<div style="padding:9px 0;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(p.nombre)}</strong> · ${p.cuerda_nombre?escapeHtml(p.cuerda_nombre):'<span class="cuerda-warning">⚠️ Sin cuerda</span>'}<br>${htmlEstadoNotificaciones(p.usuario_id)}</div>`).join('');
}

function textoFechasEvento(eventoId,fechaId=null){
  const sesiones=obtenerFechasEvento(eventoId).filter(f=>fechaId==null||Number(f.id)===fechaId);
  return sesiones.map((f,i)=>`${sesiones.length>1?'📅 '+(i+1)+'. ':'📅 '}${formatearFechaLarga(f.fecha)} · 🕐 ${formatearHora(f.hora)}${f.lugar?' · 📍 '+f.lugar:''}`).join('\n');
}
function prepararMensajeWhatsapp(){if(!eventoActual)return;eventoWhatsappId=eventoActual.id;const el=document.getElementById('mensajeWhatsapp');if(el)el.value=`🎵 ${eventoActual.titulo}\n${textoFechasEvento(eventoActual.id)}\n\nPor favor, revisa la encuesta de disponibilidad en Spirit to All.`}
function normalizarBusquedaWhatsapp(v){
  return (v||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function tokensBusquedaWhatsapp(v){return normalizarBusquedaWhatsapp(v).split(/\s+/).filter(Boolean)}
// Búsqueda tolerante a un error de escritura en palabras de 5 o más caracteres.
function whatsappDistanciaUno(a,b){
  if(a===b)return true;
  if(Math.min(a.length,b.length)<5||Math.abs(a.length-b.length)>1)return false;
  let i=0,j=0,errores=0;
  while(i<a.length&&j<b.length){
    if(a[i]===b[j]){i++;j++;continue}
    if(++errores>1)return false;
    if(a.length>b.length)i++;else if(a.length<b.length)j++;else{i++;j++}
  }
  return errores+(a.length-i)+(b.length-j)<=1;
}
function whatsappCatalogo(){
  const eventos=(eventosActuales||[]).filter(e=>!e.eliminado).map(e=>({
    tipo:'encuesta',id:Number(e.id),titulo:e.titulo||'Encuesta',estado:e.estado||'',
    fecha:e.fecha||'',lugar:e.lugar||'',descripcion:e.descripcion||'',cliente:'',
    eventoId:Number(e.id)
  }));
  const porEvento=new Map(eventos.map(e=>[e.id,e]));
  const bolos=(whatsappBolosDisponibles||[]).map(o=>({
    tipo:'bolo',id:Number(o.id),titulo:o.titulo||'Bolo',estado:o.estado||'',
    fecha:o.fecha_prevista||'',hora:o.hora_prevista||'',lugar:o.lugar||'',
    descripcion:o.notas||'',cliente:o.cliente_nombre||'',eventoId:Number(o.evento_id)||null
  }));
  const resultado=[];
  for(const o of bolos){
    if(o.eventoId&&porEvento.has(o.eventoId)){
      const e=porEvento.get(o.eventoId);
      e.cliente=o.cliente;e.tituloBolo=o.titulo;
    }else resultado.push(o);
  }
  return [...eventos,...resultado];
}
function textoBusquedaWhatsapp(e){
  const partes=[e.titulo,e.tituloBolo,e.cliente,e.descripcion,e.estado,e.fecha,e.lugar];
  if(e.tipo==='encuesta'){
    todasFechasEventos.filter(f=>Number(f.evento_id)===e.id).forEach(f=>{
      partes.push(f.fecha,f.lugar,formatearFechaCorta(f.fecha),formatearFechaLarga(f.fecha));
    });
  }else if(e.fecha)partes.push(formatearFechaCorta(e.fecha),formatearFechaLarga(e.fecha));
  return normalizarBusquedaWhatsapp(partes.filter(Boolean).join(' '));
}
function puntuacionWhatsapp(e,tokens){
  const titulo=normalizarBusquedaWhatsapp(e.titulo);
  const cliente=normalizarBusquedaWhatsapp(e.cliente);
  const texto=textoBusquedaWhatsapp(e);
  const palabras=texto.split(/[^a-z0-9]+/).filter(Boolean);
  let score=0;
  for(const t of tokens){
    if(titulo===t)score+=24;
    else if(titulo.startsWith(t))score+=14;
    else if(titulo.includes(t))score+=10;
    else if(cliente.includes(t))score+=7;
    else if(texto.includes(t))score+=5;
    else if(palabras.some(p=>whatsappDistanciaUno(t,p)))score+=2;
    else return -1;
  }
  if(e.tipo==='encuesta')score+=1;
  return score;
}
function etiquetaEstadoWhatsapp(e){
  if(e.tipo==='bolo')return '<span class="wa-estado wa-confirmado">Bolo</span>';
  if(e.estado==='abierto')return '<span class="wa-estado wa-abierto">Abierta</span>';
  if(e.estado==='confirmado')return '<span class="wa-estado wa-confirmado">Confirmada</span>';
  if(e.estado==='cancelado')return '<span class="wa-estado wa-cancelado">Cancelada</span>';
  return '<span class="wa-estado wa-finalizado">Finalizada</span>';
}
function ocultarResultadosWhatsapp(){
  const cont=document.getElementById('whatsappResultados');
  if(cont){cont.classList.add('hidden');cont.innerHTML=''}
}
function whatsappMostrarContexto(){
  const info=document.getElementById('whatsappSeleccionInfo');
  if(!info)return;
  const e=whatsappSeleccion;
  info.dataset.estado=e?.tipo||'';
  if(!e)info.textContent=whatsappCargaEnCurso?'Cargando bolos y encuestas…':'Selecciona un bolo o encuesta para preparar el mensaje.';
  else if(e.tipo==='encuesta')info.textContent='✅ Encuesta seleccionada: '+e.titulo+'. Se utilizarán sus fechas guardadas.';
  else info.textContent='📋 Bolo seleccionado: '+e.titulo+(e.cliente?' · '+e.cliente:'')+'. Sin encuesta vinculada.'+(!e.fecha?' ⚠️ No tiene fecha registrada: complétala en el mensaje antes de enviarlo.':'');
}
function buscarWhatsappMientrasEscribes(){
  const input=document.getElementById('whatsappBuscar');
  const cont=document.getElementById('whatsappResultados');
  if(!input||!cont)return;
  if(whatsappSeleccion){
    whatsappSeleccion=null;eventoWhatsappId=null;
    const caja=document.getElementById('mensajeWhatsapp');if(caja)caja.value='';
    whatsappMostrarContexto();
  }
  const tokens=tokensBusquedaWhatsapp(input.value);
  if(!tokens.length){ocultarResultadosWhatsapp();return}
  const resultados=whatsappCatalogo().map(e=>({e,score:puntuacionWhatsapp(e,tokens)}))
    .filter(x=>x.score>=0)
    .sort((a,b)=>b.score-a.score||((b.e.fecha||'')+' '+(b.e.titulo||'')).localeCompare((a.e.fecha||'')+' '+(a.e.titulo||'')))
    .slice(0,8);
  if(!resultados.length){
    cont.innerHTML='<div class="wa-vacio">'+(whatsappCargaEnCurso?'Buscando bolos y encuestas…':'No hay coincidencias. Prueba con el cliente, el concierto o una palabra más corta.')+'</div>';
    cont.classList.remove('hidden');return;
  }
  cont.innerHTML=resultados.map(({e})=>`<button type="button" class="wa-resultado" role="option"
    onclick="seleccionarEventoWhatsapp('${e.tipo}',${e.id})">
      <div class="wa-resultado-main">
        <strong>${escapeHtml(e.titulo)}</strong>
        <span>${escapeHtml(e.cliente?e.cliente+' · ':'')}${e.fecha?escapeHtml(formatearFechaCorta(e.fecha)):'Fecha por determinar'}${e.lugar?' · '+escapeHtml(e.lugar):''}</span>
      </div>${etiquetaEstadoWhatsapp(e)}
    </button>`).join('');
  cont.classList.remove('hidden');
}
async function cargarSelectorWhatsapp(){
  // Abrir WhatsApp desde la navegación no depende de haber visitado antes Clientes.
  whatsappBolosDisponibles=[];
  whatsappSeleccion=eventoActual&&eventosActuales.some(e=>Number(e.id)===Number(eventoActual.id))
    ?whatsappCatalogo().find(e=>e.tipo==='encuesta'&&e.id===Number(eventoActual.id))||null:null;
  document.getElementById('whatsappSesion').value='';
  eventoWhatsappId=whatsappSeleccion?.eventoId||null;
  const buscar=document.getElementById('whatsappBuscar');
  if(buscar)buscar.value=whatsappSeleccion?whatsappSeleccion.titulo:'';
  ocultarResultadosWhatsapp();
  whatsappCargaEnCurso=true;whatsappMostrarContexto();
  let errorCargandoBolos=false;
  void cambiarTipoWhatsapp();
  try{
    const {data,error}=await supabaseClient.rpc('crm_listar_bolos_con_coste',{p_cliente_id:null,p_estado:null});
    if(error)throw error;
    whatsappBolosDisponibles=Array.isArray(data)?data:[];
  }catch(error){
    errorCargandoBolos=true;
    console.error('WhatsApp: no se han podido cargar los bolos comerciales:',error);
    const info=document.getElementById('whatsappSeleccionInfo');
    if(info&&!whatsappSeleccion)info.textContent='⚠️ No se han podido cargar los bolos de Clientes. Las encuestas siguen disponibles. Reabre la pantalla para reintentar.';
  }finally{
    whatsappCargaEnCurso=false;
    if(whatsappSeleccion)whatsappSeleccion=whatsappCatalogo().find(e=>e.tipo===whatsappSeleccion.tipo&&e.id===whatsappSeleccion.id)||whatsappSeleccion;
    if(document.getElementById('panelWhatsapp')&&!document.getElementById('panelWhatsapp').classList.contains('hidden')){
      if(buscar?.value&&(!whatsappSeleccion))buscarWhatsappMientrasEscribes();
      if(!errorCargandoBolos||whatsappSeleccion)whatsappMostrarContexto();
    }
  }
}
function seleccionarEventoWhatsapp(tipo,id){
  // Compatibilidad con versiones anteriores que enviaban solo el id de encuesta.
  if(typeof tipo==='number'){id=tipo;tipo='encuesta'}
  const e=whatsappCatalogo().find(x=>x.tipo===tipo&&Number(x.id)===Number(id));
  if(!e)return;
  whatsappSeleccion=e;
  document.getElementById('whatsappSesion').value='';
  eventoWhatsappId=e.tipo==='encuesta'?e.id:null;
  const buscar=document.getElementById('whatsappBuscar');if(buscar)buscar.value=e.titulo;
  ocultarResultadosWhatsapp();whatsappMostrarContexto();
  void cambiarTipoWhatsapp();
}
async function cambiarTipoWhatsapp(){
  const tipo=document.getElementById('whatsappTipo')?.value||'disponibilidad';
  document.getElementById('whatsappCochesBox')?.classList.toggle('hidden',tipo!=='coches');
  document.getElementById('whatsappEnlaceBox')?.classList.toggle('hidden',!['publicacion','video'].includes(tipo));
  const sinEncuesta=Boolean(whatsappSeleccion?.tipo==='bolo');
  const guardar=document.getElementById('whatsappGuardarCoches');if(guardar)guardar.classList.toggle('hidden',sinEncuesta);
  if(tipo==='coches'){
    if(eventoWhatsappId)await cargarEnlaceCochesWhatsapp();
    else{
      const input=document.getElementById('whatsappCochesUrl'),estado=document.getElementById('whatsappCochesEstado');
      if(input)input.value='';
      if(estado)estado.textContent=sinEncuesta?'Este bolo aún no tiene encuesta: puedes pegar un enlace para el mensaje, pero no se guardará en la app.':'Selecciona un evento para utilizar su hoja de coches.';
    }
  }
  prepararWhatsappRapido();
}
async function cargarEnlaceCochesWhatsapp(){
  const input=document.getElementById('whatsappCochesUrl'),estado=document.getElementById('whatsappCochesEstado');
  const id=Number(eventoWhatsappId||0);
  if(!input)return;
  if(!id){input.value='';if(estado)estado.textContent='Selecciona un evento para cargar su hoja de coches.';return}
  if(enlacesCochesCache.has(id)){input.value=enlacesCochesCache.get(id)||'';if(estado)estado.textContent=input.value?'✅ Enlace guardado para este evento.':'Todavía no hay una hoja de coches guardada para este evento.';prepararWhatsappRapido();return}
  if(estado)estado.textContent='Cargando enlace guardado…';
  try{
    const {data,error}=await supabaseClient.rpc('obtener_enlace_coches',{p_evento_id:id});
    if(error)throw error;
    const url=String(data||'').trim();
    enlacesCochesCache.set(id,url);input.value=url;
    if(estado)estado.textContent=url?'✅ Enlace guardado para este evento.':'Todavía no hay una hoja de coches guardada para este evento.';
  }catch(error){console.error(error);if(estado)estado.textContent='❌ No se ha podido cargar el enlace de coches.'}
  prepararWhatsappRapido();
}
async function guardarEnlaceCochesWhatsapp(){
  if(!esGestor())return;
  const id=Number(eventoWhatsappId||0),input=document.getElementById('whatsappCochesUrl'),estado=document.getElementById('whatsappCochesEstado');
  const url=(input?.value||'').trim();
  if(!id){alert('Selecciona primero un evento.');return}
  if(url&&!/^https:\/\//i.test(url)){alert('El enlace debe empezar por https://');input?.focus();return}
  if(estado)estado.textContent='Guardando enlace…';
  try{
    const {data,error}=await supabaseClient.rpc('guardar_enlace_coches',{p_evento_id:id,p_url:url||null});
    if(error)throw error;
    const guardado=String(data||'').trim();enlacesCochesCache.set(id,guardado);if(input)input.value=guardado;
    if(estado)estado.textContent=guardado?'✅ Enlace guardado. Quedará disponible para gestión desde cualquier dispositivo.':'Enlace eliminado para este evento.';
    prepararWhatsappRapido();
  }catch(error){console.error(error);if(estado)estado.textContent='❌ No se ha podido guardar el enlace.';alert('No se ha podido guardar el enlace de coches. '+(error?.message||''))}
}
function abrirEnlaceCochesWhatsapp(){
  const url=(document.getElementById('whatsappCochesUrl')?.value||'').trim();
  if(!/^https:\/\//i.test(url)){alert('Guarda o pega primero un enlace válido.');return}
  window.open(url,'_blank','noopener,noreferrer');
}
const STA_WA_GRUPOS={
 encuestas:[['disponibilidad','Pedir disponibilidad'],['recordatorio','Recordar encuesta'],['confirmacion','Evento confirmado'],['no_viable','No viable']],
 logistica:[['coches','Organizar coches'],['hotel','Confirmar pernocta'],['montaje','Montaje y sonido']],
 marketing:[['publicacion','Compartir publicación'],['video','Colaborar en un vídeo']],
 otros:[['vestuario','Vestuario y material'],['seguimiento','Seguimiento comercial']]
};
let staWhatsappGrupoActual='encuestas';
function staWhatsappGrupo(grupo){
 if(!STA_WA_GRUPOS[grupo])return;
 staWhatsappGrupoActual=grupo;
 document.querySelectorAll('.wa-template-tabs button').forEach(b=>{const activo=b.dataset.waGrupo===grupo;b.classList.toggle('active',activo);b.setAttribute('aria-pressed',String(activo))});
 const contexto=document.getElementById('whatsappCoordinacion');if(contexto)contexto.textContent=({encuestas:'Coordinación habitual: José Miguel (Guaito) y Lola.',logistica:'Coordinación habitual: José Miguel (Guaito).',marketing:'Coordinación habitual: Laura Encabo.',otros:'Creatividad: Luis Alonso · Comercial: Miguel Salamanca.'})[grupo];
 const select=document.getElementById('whatsappTipo');if(!select)return;
 select.replaceChildren(...STA_WA_GRUPOS[grupo].map(([v,label])=>new Option(label,v)));
 void cambiarTipoWhatsapp();
}
function staWhatsappEnlace(){const url=document.getElementById('whatsappEnlace')?.value.trim()||'';if(!url)return '';try{const u=new URL(url);return u.protocol==='https:'&&['instagram.com','www.instagram.com','facebook.com','www.facebook.com','m.facebook.com','fb.watch'].includes(u.hostname.toLowerCase())?u.href:''}catch(_){return ''}}
function staWhatsappActualizarEnlace(){const box=document.getElementById('whatsappEnlaceVista'),url=staWhatsappEnlace();if(box){box.classList.toggle('hidden',!url);box.innerHTML=url?`<span>🔗 Vista previa del enlace</span><strong>${url.includes('instagram.com')?'Instagram':'Facebook'}</strong><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`:''}prepararWhatsappRapido()}
function staPlantillaWhatsappArea(tipo,e){
 const nombre=e?.titulo||'[concierto]';
 const primera=e?.tipo==='encuesta'?obtenerFechasEvento(e.id)?.[0]:null;
 const fecha=e?.fecha||primera?.fecha?formatearFechaLarga(e?.fecha||primera.fecha):'[fecha]';
 const lugar=e?.lugar||primera?.lugar||'[lugar]';
 const url=staWhatsappEnlace();
 const plantillas={
  hotel:`🏨 Para el concierto «${nombre}» del ${fecha} necesitamos saber quién se queda a dormir. Si vas a pernoctar, responde a este mensaje antes de [día y hora]. Si ya tienes alojamiento por tu cuenta, indícalo también para organizar las habitaciones. ¡Gracias!`,
  montaje:`🔧 Para «${nombre}» (${fecha}, ${lugar}) estamos organizando el montaje y el sonido. ¿Quién puede ayudar a montar desde [hora] o a desmontar al terminar? Responde indicando el turno que puedes cubrir. Gracias por echar una mano.`,
  publicacion:`🎶 Ya tenemos la publicación de «${nombre}» (${fecha}). ¿Nos ayudáis a compartirla en vuestras historias y con quien pueda interesarle? Así damos más visibilidad al concierto. ¡Gracias!${url?'\n\n'+url:'\n\n[Enlace a la publicación]'}`,
  video:`🎥 Queremos preparar un vídeo breve para dar a conocer «${nombre}». ¿Quién puede participar en la grabación el [día] a las [hora]? Si te apetece, responde aquí y coordinamos los detalles.${url?'\n\nReferencia: '+url:''}`,
  vestuario:`👕 Para «${nombre}» del ${fecha}, la propuesta de vestuario es [indicaciones]. Si necesitas alguna prenda o tienes dudas, escríbenos antes de [fecha]. Confirmaremos los detalles finales en la ficha del bolo.`,
  seguimiento:`Hola, [nombre]. Te escribimos desde Spirit to All sobre «${nombre}», previsto para el ${fecha} en ${lugar}. ¿Podrías confirmarnos si habéis podido revisar la propuesta? Quedamos pendientes por si necesitáis ajustar algún detalle. Muchas gracias.`
 };
 return plantillas[tipo]||'';
}
function prepararWhatsappRapido(){
  const e=whatsappSeleccion,caja=document.getElementById('mensajeWhatsapp');
  if(!caja)return;
  const selector=document.getElementById('whatsappSesion');
  const campo=document.getElementById('whatsappSesionCampo');
  const tipo=document.getElementById('whatsappTipo')?.value||'disponibilidad';
  if(['hotel','montaje','publicacion','video','vestuario','seguimiento'].includes(tipo)){campo.classList.add('hidden');caja.value=staPlantillaWhatsappArea(tipo,e);return}
  if(!e){caja.value='';campo.classList.add('hidden');return}
  const sesiones=e.tipo==='encuesta'?obtenerFechasEvento(e.id):[];
  campo.classList.toggle('hidden',sesiones.length<2);
  const anterior=Number(selector.value);
  selector.innerHTML='<option value="">Todas las fechas</option>'+sesiones.map(f=>
    `<option value="${Number(f.id)}">${escapeHtml([formatearFechaCorta(f.fecha),formatearHora(f.hora),f.lugar].filter(Boolean).join(' · '))}</option>`).join('');
  const fechaId=sesiones.length>1&&sesiones.some(f=>Number(f.id)===anterior)?anterior:null;
  selector.value=fechaId==null?'':String(fechaId);
  const fechas=e.tipo==='encuesta'?textoFechasEvento(e.id,fechaId):[
    e.fecha?'📅 '+formatearFechaLarga(e.fecha):'📅 [Completar fecha]',
    e.hora?'🕐 '+formatearHora(e.hora):'',
    e.lugar?'📍 '+e.lugar:''
  ].filter(Boolean).join(' · ');
  const titulo='🎵 '+e.titulo+(e.tipo==='bolo'&&e.cliente?'\nCliente: '+e.cliente:'');
  if(tipo==='no_viable'){
    const dias=e.tipo==='encuesta'
      ?[...new Set(sesiones.filter(f=>fechaId==null||Number(f.id)===fechaId).map(f=>f.fecha).filter(Boolean))]
      :[];
    if(!dias.length&&e.fecha)dias.push(e.fecha);
    const fecha=dias.length>1?' de los días '+dias.map(formatearFechaLarga).join(' y ')
      :' del '+(dias.length?formatearFechaLarga(dias[0]):'[fecha]');
    caja.value=`¡Hola, equipo! 😊 Tras revisar la disponibilidad, Dirección ha visto que esta vez no podremos sacar adelante el bolo de ${e.titulo}${fecha}.\n\n¡Muchas gracias por responder a la encuesta! Nos vemos en el próximo bolo 🎶`;
    return;
  }
  if(tipo==='coches'){
    const url=(document.getElementById('whatsappCochesUrl')?.value|| (e.tipo==='encuesta'?enlacesCochesCache.get(Number(e.id)):'')||'').trim();
    caja.value=`🚗 COORDINACIÓN DE COCHES · ${e.titulo}\n${fechas}${url?'\n\n🔗 Hoja compartida de coches:\n'+url:'\n\n⚠️ Falta añadir el enlace de la hoja de coches.'}\n\nPor favor, indica en la hoja si llevas coche, plazas disponibles y punto de salida.\n\n¡Gracias!`;
    return;
  }
  if(e.tipo==='bolo'){
    let cierre='Por favor, indica si puedes participar en este concierto.';
    if(tipo==='recordatorio')cierre='🔔 Recordatorio: necesitamos conocer tu disponibilidad para este concierto.';
    if(tipo==='confirmacion')cierre=['confirmado','finalizado','facturado','cobrado'].includes(e.estado)
      ?'✅ Concierto confirmado. Revisa los datos y comunícanos cualquier incidencia.': 'ℹ️ Información sobre esta actuación. Revisa los datos y comunícanos cualquier incidencia.';
    caja.value=`${titulo}\n${fechas}\n\n${cierre}`;
  }else{
    let cierre='Por favor, revisa la encuesta de disponibilidad en Spirit to All.';
    if(tipo==='recordatorio')cierre='🔔 Recordatorio: si todavía te falta alguna fecha por responder, entra en Spirit to All y completa tu disponibilidad.';
    if(tipo==='confirmacion')cierre='✅ Evento confirmado. Revisa los datos y tu disponibilidad en Spirit to All.';
    caja.value=`${titulo}\n${fechas}\n\n${cierre}`;
  }
}

document.addEventListener('click',event=>{
  const zona=event.target.closest?.('.wa-autocomplete');
  if(!zona)ocultarResultadosWhatsapp();
});

function abrirWhatsapp(){const tipo=document.getElementById('whatsappTipo')?.value||'disponibilidad';if(tipo==='publicacion'&&!staWhatsappEnlace()){alert('Pega primero el enlace público de la publicación de Instagram o Facebook.');return}if(tipo==='coches'){const url=(document.getElementById('whatsappCochesUrl')?.value||'').trim();if(!/^https:\/\//i.test(url)){alert('Antes de abrir WhatsApp, añade el enlace https:// de la hoja de coches.');return}}const texto=document.getElementById('mensajeWhatsapp').value.trim();if(!texto){alert('Escribe primero el mensaje.');return}if(/\[[^\]]+\]/.test(texto)&&!confirm('El mensaje aún contiene datos entre corchetes por completar. ¿Quieres abrir WhatsApp igualmente?'))return;window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank','noopener,noreferrer')}
function estadoClaseCalendario(estado){return estado==='confirmado'?'confirm':estado==='cancelado'?'cancel':estado==='finalizado'?'finish':'open'}
function moverMes(delta){mesCalendario=new Date(mesCalendario.getFullYear(),mesCalendario.getMonth()+delta,1);renderCalendario()}
function irMesActual(){const h=new Date();mesCalendario=new Date(h.getFullYear(),h.getMonth(),1);renderCalendario()}
function renderCalendario(){const titulo=document.getElementById('tituloMesCalendario'),grid=document.getElementById('calendarioGrid');if(!titulo||!grid)return;titulo.textContent=mesCalendario.toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(/^./,letra=>letra.toLocaleUpperCase('es-ES'));const y=mesCalendario.getFullYear(),m=mesCalendario.getMonth();const first=new Date(y,m,1);const start=(first.getDay()+6)%7;const inicio=new Date(y,m,1-start);const hoy=new Date();let html='';for(let i=0, totalDias=Math.ceil((start+new Date(y,m+1,0).getDate())/7)*7;i<totalDias;i++){const d=new Date(inicio);d.setDate(inicio.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const fechas=todasFechasEventos.filter(f=>f.fecha===iso);const fuera=d.getMonth()!==m?' out':'';const esHoy=d.toDateString()===hoy.toDateString()?' today':'';const dots=fechas.slice(0,5).map(f=>{const e=eventosActuales.find(x=>Number(x.id)===Number(f.evento_id));return `<span class="cal-dot dot-${estadoClaseCalendario(e?.estado)}"></span>`}).join('');html+=`<button class="cal-day${fuera}${esHoy}" data-fecha="${iso}" aria-label="${escapeHtml(formatearFechaLarga(iso))}" onclick="mostrarDiaCalendario('${iso}')"><span class="cal-num">${d.getDate()}</span><div class="cal-dots">${dots}</div>${fechas.length>5?`<div class="cal-more">+${fechas.length-5}</div>`:''}</button>`}grid.innerHTML=html;document.getElementById('agendaDia').innerHTML='<p class="muted">Pulsa un día con eventos para verlos.</p>'}
function mostrarDiaCalendario(fecha){const fs=todasFechasEventos.filter(f=>f.fecha===fecha);const agenda=document.getElementById('agendaDia');agenda.innerHTML=`<h3>📅 ${formatearFechaLarga(fecha)}</h3>`+(!fs.length?'<p class="muted">No hay eventos este día.</p>':fs.map(f=>{const e=eventosActuales.find(x=>Number(x.id)===Number(f.evento_id));if(!e)return'';return `<button class="agenda-event agenda-${estadoClaseCalendario(e.estado)}" onclick="abrirEventoDesdeCalendario(${e.id})"><strong>${escapeHtml(e.titulo)}</strong><span class="muted">🕐 ${formatearHora(f.hora)}${f.lugar?' · 📍 '+escapeHtml(f.lugar):''}</span></button>`}).join(''))}
async function abrirEventoDesdeCalendario(eventoId){origenDetalleEvento='calendario';await seleccionarEvento(Number(eventoId),'calendario')}
function staFechaMadrid(fecha=new Date()){
  const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(fecha);
  const valor=tipo=>partes.find(p=>p.type===tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
function formatearFechaLarga(fecha){if(!fecha)return'';const p=fecha.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);let t=d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});return t.charAt(0).toUpperCase()+t.slice(1)}
function formatearFechaCorta(fecha){if(!fecha)return'';const p=fecha.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);return d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}
function formatearHora(hora){return hora?hora.substring(0,5):''}
function escapeHtml(texto){return String(texto??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}

let deferredInstallPrompt = null;

function estaEnModoApp(){
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.matchMedia('(display-mode: fullscreen)').matches ||
         window.navigator.standalone === true;
}

function esIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function actualizarBotonInstalacion(){
  const btn=document.getElementById('btnInstalarApp');
  const aprobado=!!(perfilActual&&perfilActual.aprobado===true&&perfilActual.eliminado!==true);
  btn?.classList.toggle('hidden',!aprobado);
  document.getElementById('staInstalarInicio')?.classList.toggle('hidden',!aprobado||estaEnModoApp());
}

function mostrarInvitacionInstalacion(){
  if(!usuarioActual||estaEnModoApp()||instalacionConfirmada)return;
  const clave='sta-instalacion-vista:'+usuarioActual.id;
  try{
    if(localStorage.getItem(clave))return;
    localStorage.setItem(clave,'1');
  }catch(_){return}
  abrirInstalacion();
}

function cerrarInstalacion(){
  document.getElementById('modalInstalacion')?.classList.add('hidden');
  document.body.style.overflow='';
}

function abrirInstalacion(){
  const modal=document.getElementById('modalInstalacion');
  if(!modal)return;
  modal.classList.remove('hidden');
  document.body.style.overflow='hidden';
  renderInstalacion();
}

let instalacionConfirmada=false;
let instalacionEnCurso=false;

function renderInstalacion(mensajeExtra=''){
  const estado=document.getElementById('estadoInstalacionModal');
  const instrucciones=document.getElementById('instruccionesInstalacion');
  const boton=document.getElementById('btnInstalarDirecto');
  if(!estado||!instrucciones||!boton)return;

  const instalada=estaEnModoApp()||instalacionConfirmada;
  const ios=esIOS();
  const android=/Android/i.test(navigator.userAgent);
  const directa=!instalada&&!ios&&!!deferredInstallPrompt;
  boton.classList.toggle('hidden',!directa);
  boton.disabled=instalacionEnCurso;
  instrucciones.classList.toggle('hidden',instalada);
  if(instalada){
    estado.textContent='✅ Spirit to All está instalada. Busca su icono entre tus aplicaciones.';
    return;
  }
  estado.textContent=mensajeExtra||(directa
    ? 'Pulsa «Instalar app» y confirma en la ventana del navegador.'
    : 'Añade Spirit to All desde el menú de tu navegador.');
  if(ios){
    instrucciones.innerHTML='<ol class="install-steps"><li>Abre el enlace en un navegador normal, fuera de WhatsApp u otras apps.</li><li>Pulsa <strong>⋯</strong> o <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba).</li><li>Elige <strong>Añadir a pantalla de inicio</strong>. Si aparece <strong>Abrir como app web</strong>, actívalo y pulsa <strong>Añadir</strong>.</li></ol><p class="muted">Si no ves esa opción, prueba con otro navegador que la ofrezca.</p>';
  }else if(android){
    instrucciones.innerHTML='<ol class="install-steps"><li>Si abriste Spirit desde WhatsApp u otra app, copia el enlace y ábrelo en <strong>Chrome</strong>, en una pestaña normal.</li><li>En Chrome, pulsa <strong>⋮ → Añadir a pantalla de inicio → Instalar</strong>. Si ves <strong>Instalar aplicación</strong> directamente, elige esa opción.</li><li>Confirma y busca <strong>Spirit to All</strong> entre tus aplicaciones. Si solo aparece <strong>Crear acceso directo</strong>, puedes usarlo para abrir la web y seguir usando Spirit.</li></ol>';
  }else{
    instrucciones.innerHTML='<ol class="install-steps"><li>En Chrome, abre <strong>⋮ → Enviar, guardar y compartir → Instalar página como aplicación</strong>.</li><li>En Edge, abre <strong>⋯ → Aplicaciones → Instalar este sitio como aplicación</strong>.</li></ol>';
  }
}

window.addEventListener('beforeinstallprompt',(event)=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  comprobarInstalacion();
});

window.addEventListener('appinstalled',()=>{
  instalacionConfirmada=true;
  deferredInstallPrompt=null;
  comprobarInstalacion();
});

async function instalarApp(){
  if(instalacionEnCurso)return;
  if(estaEnModoApp()||instalacionConfirmada||!deferredInstallPrompt){
    renderInstalacion();
    return;
  }
  const promptGuardado=deferredInstallPrompt;
  deferredInstallPrompt=null;
  instalacionEnCurso=true;
  let mensaje='Si el botón no abre una ventana, usa el menú del navegador que se indica abajo.';
  try{
    const eleccion=await esperarAvisos((async()=>{
      const resultado=await promptGuardado.prompt();
      return resultado?.outcome?resultado:await promptGuardado.userChoice;
    })(),mensaje,30000);
    mensaje=eleccion?.outcome==='accepted'
      ? 'Has aceptado la instalación. Busca Spirit entre tus aplicaciones. Si aún no aparece, comprueba la opción de instalación en el menú del navegador.'
      : 'La instalación se ha cancelado. Puedes volver a iniciarla desde el menú del navegador.';
  }catch(error){
    console.warn('No se pudo confirmar la instalación:',error);
  }finally{
    instalacionEnCurso=false;
    renderInstalacion(mensaje);
  }
}

function comprobarInstalacion(){
  actualizarBotonInstalacion();
  const modal=document.getElementById('modalInstalacion');
  if(modal&&!modal.classList.contains('hidden'))renderInstalacion();
}


let registroServiceWorkerSpirit=null;
let recargaPorActualizacion=false;
let staRecargaSolicitada=false;
function staRecargarUnaVez(){if(staRecargaSolicitada)return;staRecargaSolicitada=true;window.location.reload()}

let staUpdateRemoteBuild='';
const STA_UPDATE_LAST_BUILD_KEY='sta_update_last_loaded_build';
const STA_UPDATE_ACK_BUILD_KEY='sta_update_ack_build';
const STA_UPDATE_SNOOZE_SESSION_KEY='sta_update_snoozed_session';
const STA_UPDATE_APPLYING_SESSION_KEY='sta_update_applying_build';

function staConfigurarAvisoVersion(modo='pendiente',build=''){
  const aviso=document.getElementById('avisoNuevaVersion');
  if(!aviso)return;
  const icono=aviso.querySelector('.update-icon');
  const titulo=aviso.querySelector('.update-copy strong');
  const texto=aviso.querySelector('.update-copy p');
  const ahora=aviso.querySelector('.update-now');
  const luego=aviso.querySelector('.update-later');
  if(modo==='cargada'){
    if(icono)icono.textContent='✓';
    if(titulo)titulo.textContent='Aplicación actualizada';
    if(texto)texto.textContent='Ya estás usando la versión '+(build||STA_BUILD)+' de Spirit to All. No necesitas hacer nada más.';
    if(ahora){ahora.disabled=false;ahora.textContent='ENTENDIDO';ahora.onclick=confirmarVersionCargada}
    if(luego)luego.style.display='none';
    aviso.dataset.modo='cargada';
  }else{
    if(icono)icono.textContent='↻';
    if(titulo)titulo.textContent='Nueva versión disponible';
    if(texto)texto.textContent='Hay una versión nueva de Spirit to All'+(build?' ('+build+')':'')+'. Pulsa «Actualizar ahora» para cargarla. No necesitas cerrar sesión.';
    if(ahora){ahora.disabled=false;ahora.textContent='ACTUALIZAR AHORA';ahora.onclick=actualizarSpiritAhora}
    if(luego){luego.style.display='';luego.textContent='MÁS TARDE';luego.onclick=ocultarAvisoNuevaVersion}
    aviso.dataset.modo='pendiente';
  }
}
function mostrarAvisoNuevaVersion(build=''){
  if(build&&build===STA_BUILD)return;
  try{if(sessionStorage.getItem(STA_UPDATE_SNOOZE_SESSION_KEY)===(build||'pendiente'))return}catch(_){}
  const actual=document.getElementById('avisoNuevaVersion');
  if(actual?.classList.contains('visible')&&actual.dataset.modo==='pendiente'&&staUpdateRemoteBuild===build)return;
  staUpdateRemoteBuild=build||staUpdateRemoteBuild||'';
  staConfigurarAvisoVersion('pendiente',staUpdateRemoteBuild);
  document.getElementById('avisoNuevaVersion')?.classList.add('visible');
}
function mostrarAvisoVersionCargada(){
  staConfigurarAvisoVersion('cargada',STA_BUILD);
  document.getElementById('avisoNuevaVersion')?.classList.add('visible');
}
function confirmarVersionCargada(){
  try{localStorage.setItem(STA_UPDATE_ACK_BUILD_KEY,STA_BUILD)}catch(_){}
  ocultarAvisoNuevaVersion();
}
function ocultarAvisoNuevaVersion(){
  const aviso=document.getElementById('avisoNuevaVersion');
  if(aviso?.dataset?.modo==='pendiente'){
    try{sessionStorage.setItem(STA_UPDATE_SNOOZE_SESSION_KEY,staUpdateRemoteBuild||'pendiente')}catch(_){}
  }
  aviso?.classList.remove('visible');
}
function prepararDeteccionActualizaciones(reg){
  registroServiceWorkerSpirit=reg;
  if(reg.waiting&&navigator.serviceWorker.controller)void comprobarNuevaVersionIndex();

  reg.addEventListener('updatefound',()=>{
    const nuevo=reg.installing;
    if(!nuevo)return;
    nuevo.addEventListener('statechange',()=>{
      if(nuevo.state==='installed'&&navigator.serviceWorker.controller){
        void comprobarNuevaVersionIndex();
      }
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!recargaPorActualizacion)return;
    recargaPorActualizacion=false;
    staRecargarUnaVez();
  });
}
async function actualizarSpiritAhora(){
  try{sessionStorage.removeItem(STA_UPDATE_SNOOZE_SESSION_KEY)}catch(_){}
  try{sessionStorage.setItem(STA_UPDATE_APPLYING_SESSION_KEY,staUpdateRemoteBuild||'pendiente')}catch(_){}
  const boton=document.querySelector('#avisoNuevaVersion .update-now');
  if(boton){boton.disabled=true;boton.textContent='ACTUALIZANDO…'}
  recargaPorActualizacion=true;
  try{
    const reg=registroServiceWorkerSpirit||await navigator.serviceWorker.getRegistration('./');
    if(reg?.waiting){
      reg.waiting.postMessage({type:'SKIP_WAITING'});
      setTimeout(staRecargarUnaVez,1800);
      return;
    }
    if(reg){
      await reg.update().catch(()=>{});
      if(reg.waiting){
        reg.waiting.postMessage({type:'SKIP_WAITING'});
        setTimeout(staRecargarUnaVez,1800);
        return;
      }
    }
    staRecargarUnaVez();
  }catch(error){
    console.error('No se pudo aplicar la actualización:',error);
    staRecargarUnaVez();
  }
}
window.addEventListener('DOMContentLoaded',iniciarComprobacionNuevaVersion);

const STA_BUILD=document.querySelector('meta[name="sta-build"]')?.content||'2026-10-23-0820';
let staUpdateCheckTimer=null;

async function comprobarNuevaVersionIndex(){
  try{
    const url='./version.json?sta_update_check='+Date.now();
    const respuesta=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    if(!respuesta.ok)return;
    const remoto=(await respuesta.json())?.build||'';
    if(remoto&&remoto!==STA_BUILD){
      mostrarAvisoNuevaVersion(remoto);
      return;
    }
    // La versión ya está cargada: no lanzar un segundo aviso de confirmación.
    if(document.getElementById('avisoNuevaVersion')?.dataset.modo==='pendiente')document.getElementById('avisoNuevaVersion')?.classList.remove('visible');
    // La versión cargada solo se marca como reconocida al pulsar «ENTENDIDO».
  }catch(error){
    console.debug('Comprobación de versión no disponible:',error);
  }
}

function iniciarComprobacionNuevaVersion(){
  // Si la app se abrió después de publicar, el HTML nuevo ya está cargado.
  // Conservar la versión anterior antes de actualizar LAST para informar una sola vez.
  try{
    const previa=localStorage.getItem(STA_UPDATE_LAST_BUILD_KEY);
    const reconocida=localStorage.getItem(STA_UPDATE_ACK_BUILD_KEY);
    const aplicando=sessionStorage.getItem(STA_UPDATE_APPLYING_SESSION_KEY);
    localStorage.setItem(STA_UPDATE_LAST_BUILD_KEY,STA_BUILD);
    if(previa&&previa!==STA_BUILD&&(aplicando===STA_BUILD||aplicando==='pendiente')){
      sessionStorage.removeItem(STA_UPDATE_APPLYING_SESSION_KEY);
      localStorage.setItem(STA_UPDATE_ACK_BUILD_KEY,STA_BUILD);
    }else if(previa&&previa!==STA_BUILD&&reconocida!==STA_BUILD)mostrarAvisoVersionCargada();
  }catch(_){}
  comprobarNuevaVersionIndex();
  if(staUpdateCheckTimer)clearInterval(staUpdateCheckTimer);
  staUpdateCheckTimer=setInterval(comprobarNuevaVersionIndex,120000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')comprobarNuevaVersionIndex();
  });
  window.addEventListener('focus',comprobarNuevaVersionIndex);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', {scope:'./'});
      prepararDeteccionActualizaciones(reg);
      await navigator.serviceWorker.ready;
      await reg.update().catch(() => {});
      console.log('Spirit to All PWA preparada');
      comprobarInstalacion();
    } catch (error) {
      console.error('Error registrando service worker:', error);
      actualizarBotonInstalacion();
    }
  });
}

anadirFechaCreacion();
comprobarUsuario();



// =========================================================
// PRESUPUESTOS · flujo comercial ligero
// =========================================================
let presupuestoActual=null;
function eur(v){return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v||0))}
function cargarSelectorPresupuestos(){
  const h=document.getElementById('presupuestoEvento');if(h)h.value='';
  const b=document.getElementById('presupuestoEventoBuscar');if(b)b.value='';
  const r=document.getElementById('presupuestoEventoResultados');if(r)r.innerHTML='';
  const c=document.getElementById('presupuestoEventoSeleccionado');if(c)c.classList.add('hidden');
  document.getElementById('presupuestoForm')?.classList.add('hidden');
}
function buscarEventoPresupuesto(valor){const box=document.getElementById('presupuestoEventoResultados'),q=staNormalizarBusqueda(valor);if(!box)return;if(!q){box.innerHTML='';return}const arr=eventosActuales.filter(e=>!e.eliminado&&staNormalizarBusqueda(`${e.titulo||''} ${e.fecha||''} ${e.lugar||''}`).includes(q)).slice(0,6);box.innerHTML=arr.length?arr.map(e=>`<button class="sta-search-result" type="button" onclick="seleccionarEventoPresupuesto(${Number(e.id)})"><strong>${escapeHtml(e.titulo||'Evento')}</strong><small>${escapeHtml(formatearFechaCorta(e.fecha||''))}${e.lugar?' · '+escapeHtml(e.lugar):''}</small></button>`).join(''):'<div class="sta-empty-search">Sin coincidencias.</div>'}
function seleccionarEventoPresupuesto(id){const e=eventosActuales.find(x=>Number(x.id)===Number(id));if(!e)return;document.getElementById('presupuestoEvento').value=String(id);document.getElementById('presupuestoEventoBuscar').value=e.titulo||'';document.getElementById('presupuestoEventoResultados').innerHTML='';const c=document.getElementById('presupuestoEventoSeleccionado');c.textContent='✓ '+staTextoEvento(e);c.classList.remove('hidden');cargarPresupuestoEvento(id)}
async function cargarPresupuestoEvento(id){
  const form=document.getElementById('presupuestoForm');if(!id){form?.classList.add('hidden');return}
  presupuestoActual=null;
  form?.classList.add('hidden');
  const evento=eventosActuales.find(e=>Number(e.id)===Number(id));
  const {data,error}=await supabaseClient.rpc('obtener_presupuesto_evento',{p_evento_id:Number(id)});
  if(Number(document.getElementById('presupuestoEvento')?.value)!==Number(id))return;
  if(error){console.error(error);alert('No se ha podido cargar el presupuesto. ¿Has ejecutado el SQL de Presupuestos?');return}
  presupuestoActual=(Array.isArray(data)?data[0]:data)||null;
  document.getElementById('presupuestoCliente').value=presupuestoActual?.cliente||'';
  document.getElementById('presupuestoEmail').value=presupuestoActual?.email_destino||'';
  document.getElementById('presupuestoImporte').value=presupuestoActual?.importe??'';
  document.getElementById('presupuestoEstado').value=presupuestoActual?.estado||'preparado';
  document.getElementById('presupuestoConcepto').value=presupuestoActual?.concepto||`Actuación de Spirit to All${evento?.titulo?' · '+evento.titulo:''}`;
  document.getElementById('presupuestoNotas').value=presupuestoActual?.notas||'';
  pintarEstadoPresupuesto();document.getElementById('btnEliminarPresupuesto')?.classList.toggle('hidden',!presupuestoActual?.id);document.getElementById('btnHistorialPresupuesto')?.classList.toggle('hidden',!presupuestoActual?.id);form?.classList.remove('hidden');
}
function pintarEstadoPresupuesto(){const estado=document.getElementById('presupuestoEstado')?.value||presupuestoActual?.estado||'preparado';const nombres={preparado:'Preparado',enviado:'Enviado',aceptado:'Aceptado',rechazado:'Rechazado',anulado:'Anulado'};const b=document.getElementById('presupuestoEstadoBadge');if(b)b.textContent=nombres[estado]||estado;const g=document.getElementById('presupuestoGuardado');if(g)g.textContent=presupuestoActual?.actualizado_en?'Guardado':''}
async function guardarPresupuesto(){
  const eventoId=Number(document.getElementById('presupuestoEvento')?.value||0),importe=Number(document.getElementById('presupuestoImporte')?.value||0),msg=document.getElementById('presupuestoMensaje');
  if(!eventoId||importe<0){if(msg)msg.textContent='⚠️ Revisa el evento y el importe.';return false}
  if(msg)msg.textContent='Guardando…';
  const payload={p_evento_id:eventoId,p_cliente:document.getElementById('presupuestoCliente').value.trim(),p_email_destino:document.getElementById('presupuestoEmail').value.trim(),p_importe:importe,p_estado:document.getElementById('presupuestoEstado').value,p_concepto:document.getElementById('presupuestoConcepto').value.trim(),p_notas:document.getElementById('presupuestoNotas').value.trim()};
  const {data,error}=await supabaseClient.rpc('guardar_presupuesto_evento',payload);
  if(error){console.error(error);const em=String(error.message||'');if(msg)msg.textContent=/evento_id.*ambiguous|ambiguous.*evento_id/i.test(em)?'❌ Error interno al guardar el presupuesto. No falta ningún dato del formulario; actualiza la app y vuelve a intentarlo.':'❌ No se ha podido guardar el presupuesto. '+em;return false}
  presupuestoActual=(Array.isArray(data)?data[0]:data)||{...payload,actualizado_en:new Date().toISOString()};pintarEstadoPresupuesto();if(msg)msg.textContent='✅ Presupuesto guardado.';return true
}
async function eliminarPresupuestoActual(){
  const id=Number(presupuestoActual?.id||0);
  if(!id||!confirm('¿Eliminar definitivamente este presupuesto?'))return;
  const {error}=await supabaseClient.rpc('eliminar_presupuesto',{p_id:id});
  if(error){console.error(error);alert('No se ha podido eliminar el presupuesto. '+(error.message||''));return}
  presupuestoActual=null;
  document.getElementById('presupuestoForm')?.classList.add('hidden');
  document.getElementById('presupuestoEventoSeleccionado')?.classList.add('hidden');
  const b=document.getElementById('presupuestoEventoBuscar');if(b)b.value='';
  const h=document.getElementById('presupuestoEvento');if(h)h.value='';
  alert('Presupuesto eliminado.');
}
function datosPresupuesto(){const id=Number(document.getElementById('presupuestoEvento')?.value||0),e=eventosActuales.find(x=>Number(x.id)===id);return{evento:e,cliente:document.getElementById('presupuestoCliente').value.trim(),email:document.getElementById('presupuestoEmail').value.trim(),importe:Number(document.getElementById('presupuestoImporte').value||0),concepto:document.getElementById('presupuestoConcepto').value.trim(),notas:document.getElementById('presupuestoNotas').value.trim()}}
function imprimirPresupuesto(){const d=datosPresupuesto();if(!d.evento){alert('Selecciona un evento.');return}const w=window.open('','_blank');if(!w){alert('El navegador ha bloqueado la ventana de impresión.');return}const safe=x=>escapeHtml(String(x||''));w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Presupuesto · Spirit to All</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;max-width:760px;margin:40px auto;padding:30px}header{display:flex;justify-content:space-between;border-bottom:3px solid #ff7900;padding-bottom:20px;margin-bottom:30px}img{max-width:170px;max-height:80px}h1{font-size:28px;margin:0}.tag{color:#777}.box{background:#f7f7f8;border-radius:14px;padding:18px;margin:18px 0}.amount{font-size:30px;font-weight:800}.foot{margin-top:50px;font-size:12px;color:#666}@media print{body{margin:0}}</style>
<style id="sta-v21-fixed-screen-nav">
/* V21 · navegación fija y siempre visible en Mis encuestas y Redes */
.sta-fixed-screen-nav{display:none;position:fixed;top:0;left:0;right:0;z-index:9000;height:64px;padding:10px 14px;grid-template-columns:76px minmax(0,1fr) 76px;align-items:center;gap:8px;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 2px 10px rgba(0,0,0,.06);box-sizing:border-box;padding-top:max(10px,env(safe-area-inset-top))}
.sta-fixed-screen-nav.visible{display:grid!important}
.sta-fixed-screen-nav strong{text-align:center;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sta-fixed-screen-nav button{border:0;background:transparent;color:#e76f00;font:inherit;font-size:14px;font-weight:900;padding:10px 4px;white-space:nowrap}
#misEncuestas.sta-standalone-screen,#accesosSpirit.sta-standalone-screen{padding-top:78px!important}
#misEncuestas.sta-standalone-screen>.sta-standalone-bar,#accesosSpirit.sta-standalone-screen>.sta-standalone-bar{display:none!important}
@media(max-width:380px){.sta-fixed-screen-nav{grid-template-columns:68px minmax(0,1fr) 68px;padding-left:8px;padding-right:8px}.sta-fixed-screen-nav strong{font-size:16px}.sta-fixed-screen-nav button{font-size:13px}}
</style>

</head><body><header><div><img src="logo-header.png" alt="Spirit to All"></div><div style="text-align:right"><h1>PRESUPUESTO</h1><div class="tag">Spirit to All</div></div></header><div class="box"><strong>Cliente</strong><br>${safe(d.cliente||'—')}</div><p><strong>Evento:</strong> ${safe(d.evento.titulo||'Evento')}<br><strong>Fecha:</strong> ${safe(formatearFechaCorta(d.evento.fecha||''))}</p><h2>${safe(d.concepto||'Actuación de Spirit to All')}</h2><p class="amount">${safe(eur(d.importe))}</p>${d.notas?`<div class="box"><strong>Condiciones / observaciones</strong><br>${safe(d.notas).replace(/\n/g,'<br>')}</div>`:''}<p class="foot">Presupuesto generado desde la aplicación privada de gestión de Spirit to All.</p><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script>
<style>
.sta-pending-spotlight{margin:12px 0 14px;padding:12px;border:1px solid #f0c27a;border-radius:18px;background:#fff8ed;box-shadow:0 8px 22px rgba(0,0,0,.06)}
.sta-pending-spotlight.resuelto{border-color:#b9dec4;background:#f2fbf5}
.sta-pending-spotlight-main{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;border:0;background:transparent;text-align:left;padding:2px;cursor:pointer;color:#171717}
.sta-pending-spotlight-main:disabled{cursor:default;opacity:.8}
.sta-pending-spotlight-icon{width:42px;height:42px;border-radius:13px;background:#fff;display:grid;place-items:center;font-size:21px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
.sta-pending-spotlight-copy{min-width:0;display:flex;flex-direction:column;gap:3px}
.sta-pending-spotlight-copy strong{font-size:15px}
.sta-pending-spotlight-copy small{font-size:12px;line-height:1.35;color:#666}
.sta-pending-spotlight-count{min-width:36px;height:36px;padding:0 8px;border-radius:18px;background:#171717;color:#fff;display:grid;place-items:center;font-weight:900}
.sta-pending-spotlight.resuelto .sta-pending-spotlight-count{background:#26764b}
.sta-pending-remind-now{width:100%;min-height:46px;margin-top:10px;border:0;border-radius:13px;background:#171717;color:#fff;font-weight:900;font-size:14px}
.sta-pending-remind-now:disabled{opacity:.45}
.sta-pending-message{margin:8px 3px 0;font-size:12px}
.sta-pending-date-list{display:grid;gap:8px;margin:12px 0}
.sta-pending-date-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e4e4e7;background:#fff;border-radius:14px;padding:12px 14px;text-align:left;color:#171717}
.sta-pending-date-row span{display:flex;flex-direction:column;gap:3px}.sta-pending-date-row small{color:#666}
</style>


</body></html>`);w.document.close()}
function prepararCorreoPresupuesto(){const d=datosPresupuesto();if(!d.evento){alert('Selecciona un evento.');return}const asunto=`Presupuesto Spirit to All · ${d.evento.titulo||'Evento'}`;const cuerpo=`Buenos días:

Adjuntamos presupuesto para ${d.evento.titulo||'el evento'}.

Concepto: ${d.concepto||'Actuación de Spirit to All'}
Importe: ${eur(d.importe)}

${d.notas?d.notas+'\n\n':''}Un saludo,
Spirit to All`;location.href=`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`}


// =========================================================
// FACTURACIÓN · presupuestos y facturas
// =========================================================
let facturasCache=[];
function cambiarDineroVista(vista){
  const facturas=vista==='facturas';
  document.getElementById('moneyPresupuestos')?.classList.toggle('hidden',facturas);
  document.getElementById('moneyFacturas')?.classList.toggle('hidden',!facturas);
  document.getElementById('moneyTabPresupuestos')?.classList.toggle('active',!facturas);
  document.getElementById('moneyTabFacturas')?.classList.toggle('active',facturas);
  if(facturas)cargarFacturas();else cargarSelectorPresupuestos();
}
// La configuración fiscal ya no se persiste en localStorage. Las implementaciones seguras
// se cargan al final del documento y usan RPC cifrado en Supabase.
function staDatosEmisor(){return{nombre:'Spirit to All',cif:'',direccion:''}}
function guardarDatosEmisor(){return false}
function datosEmisorForm(){return{nombre:document.getElementById('facturaEmisorNombre')?.value.trim()||'Spirit to All',cif:document.getElementById('facturaEmisorCif')?.value.trim()||'',direccion:document.getElementById('facturaEmisorDireccion')?.value.trim()||''}}
function cargarDatosEmisorForm(){const d=staDatosEmisor();if(document.getElementById('facturaEmisorNombre'))document.getElementById('facturaEmisorNombre').value=d.nombre||'Spirit to All';if(document.getElementById('facturaEmisorCif'))document.getElementById('facturaEmisorCif').value=d.cif||'';if(document.getElementById('facturaEmisorDireccion'))document.getElementById('facturaEmisorDireccion').value=d.direccion||''}
function guardarDatosEmisorDesdeForm(){return false}
let staFacturaContextoBolo=null;
async function cargarFacturas(){
  const lista=document.getElementById('facturasLista');if(lista)lista.innerHTML='<p class="muted">Cargando facturas…</p>';
  const {data,error}=await supabaseClient.rpc('listar_facturas');
  if(error){
    console.error(error);
    const mensaje=error.code==='42501'?'Tu cuenta no tiene permiso para consultar las facturas.':error.code==='PGRST202'?'La función de facturación no está disponible. Avisa a administración.':'No se han podido cargar las facturas.';
    if(lista)lista.innerHTML=`<p role="alert">${mensaje}</p>${error.code==='42501'?'':'<button type="button" class="btn-light" onclick="cargarFacturas()">Reintentar</button>'}`;
    return;
  }
  facturasCache=data||[];
  const resumen=document.getElementById('facturasResumen');
  if(resumen)resumen.textContent=facturasCache.length===1?'1 factura guardada':`${facturasCache.length} facturas guardadas`;
  const buscador=document.getElementById('buscarFactura');
  pintarListaFacturas(buscador?.value||'');
}
function pintarListaFacturas(termino=''){
  const lista=document.getElementById('facturasLista');if(!lista)return;
  const q=staNormalizarBusqueda(termino);
  const contexto=staFacturaContextoBolo;
  const base=contexto?facturasCache.filter(f=>Number(f.evento_id)===contexto.id):facturasCache;
  if(contexto)document.getElementById('facturasResumen').textContent=`${contexto.titulo} · ${base.length} factura(s)`;
  if(!q&&!contexto){
    lista.innerHTML=base.length
      ? '<div class="sta-empty-state">🔎 Busca por número, cliente, fecha, importe o estado. Las facturas no se muestran automáticamente.</div>'
      : '<div class="sta-empty-state">Todavía no hay facturas guardadas.</div>';
    return;
  }
  const datos=base.filter(f=>staNormalizarBusqueda(`${f.numero||''} ${f.cliente||''} ${f.fecha_emision||''} ${f.importe??''} ${f.estado||''}`).includes(q)).slice(0,20);
  if(!datos.length){lista.innerHTML='<p class="muted">No hay facturas que coincidan con la búsqueda.</p>';return}
  lista.innerHTML=datos.map(f=>`<button class="invoice-item" type="button" onclick="editarFactura(${Number(f.id)})"><span><strong>${escapeHtml(f.numero||'Factura')}</strong><small>${escapeHtml(f.cliente||'')} · ${escapeHtml(formatearFechaCorta(f.fecha_emision||''))} · ${escapeHtml(eur(f.importe))}</small></span><span class="invoice-state ${escapeHtml(f.estado||'borrador')}">${escapeHtml((f.estado||'borrador').toUpperCase())}</span></button>`).join('');
}
function staNormalizarBusqueda(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
function staTextoEvento(e){return `${e.titulo||'Evento'} · ${formatearFechaCorta(e.fecha||'')}${e.lugar?' · '+e.lugar:''}`}
function buscarEventoFactura(valor){
 const box=document.getElementById('facturaEventoResultados'),q=staNormalizarBusqueda(valor);if(!box)return;
 if(!q){box.innerHTML='';return}
 const arr=eventosActuales.filter(e=>!e.eliminado&&staNormalizarBusqueda(`${e.titulo||''} ${e.fecha||''} ${e.lugar||''}`).includes(q)).slice(0,6);
 box.innerHTML=arr.length?arr.map(e=>`<button class="sta-search-result" type="button" onclick="seleccionarEventoFactura(${Number(e.id)})"><strong>${escapeHtml(e.titulo||'Evento')}</strong><small>${escapeHtml(formatearFechaCorta(e.fecha||''))}${e.lugar?' · '+escapeHtml(e.lugar):''}</small></button>`).join(''):'<div class="sta-empty-search">Sin coincidencias.</div>';
}
function seleccionarEventoFactura(id){const e=eventosActuales.find(x=>Number(x.id)===Number(id));if(!e)return;document.getElementById('facturaEvento').value=String(id);document.getElementById('facturaEventoBuscar').value=e.titulo||'';document.getElementById('facturaEventoResultados').innerHTML='';const c=document.getElementById('facturaEventoSeleccionado');c.textContent='✓ '+staTextoEvento(e);c.classList.remove('hidden')}
function limpiarEventoFactura(){document.getElementById('facturaEvento').value='';document.getElementById('facturaEventoBuscar').value='';document.getElementById('facturaEventoResultados').innerHTML='';document.getElementById('facturaEventoSeleccionado').classList.add('hidden')}
function cargarEventosFactura(){limpiarEventoFactura()}
function nuevaFactura(){
  cargarEventosFactura();cargarDatosEmisorForm();
  document.getElementById('facturaId').value='';document.getElementById('facturaNumero').textContent='Nueva factura';document.getElementById('facturaGuardado').textContent='';
  document.getElementById('facturaFecha').value=staFechaMadrid();limpiarEventoFactura();document.getElementById('facturaEstado').value='borrador';
  ['facturaCliente','facturaCif','facturaEmail','facturaDireccion','facturaConcepto','facturaImporte','facturaFundamento','facturaNotas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('facturaIva').value='exento';document.getElementById('facturaMensaje').textContent='';document.getElementById('btnEliminarFactura')?.classList.add('hidden');document.getElementById('btnHistorialFactura')?.classList.add('hidden');document.getElementById('facturaForm').classList.remove('hidden');
  if(staFacturaContextoBolo)seleccionarEventoFactura(staFacturaContextoBolo.id);
  document.getElementById('facturaForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function editarFactura(id){
  const f=facturasCache.find(x=>Number(x.id)===Number(id));if(!f)return;nuevaFactura();
  document.getElementById('facturaId').value=String(f.id);document.getElementById('facturaNumero').textContent=f.numero||'Factura';document.getElementById('facturaGuardado').textContent='Guardada';
  document.getElementById('facturaFecha').value=f.fecha_emision||'';if(f.evento_id)seleccionarEventoFactura(f.evento_id);else limpiarEventoFactura();document.getElementById('facturaEstado').value=f.estado||'borrador';
  document.getElementById('facturaCliente').value=f.cliente||'';document.getElementById('facturaCif').value=f.cif_nif||'';document.getElementById('facturaEmail').value=f.email||'';document.getElementById('facturaDireccion').value=f.direccion||'';document.getElementById('facturaConcepto').value=f.concepto||'';document.getElementById('facturaImporte').value=f.importe??'';document.getElementById('facturaIva').value=f.tratamiento_iva||'exento';document.getElementById('facturaFundamento').value=f.fundamento_iva||'';document.getElementById('facturaNotas').value=f.notas||'';document.getElementById('btnEliminarFactura')?.classList.remove('hidden');document.getElementById('btnHistorialFactura')?.classList.remove('hidden');
}
async function eliminarFacturaActual(){
  const id=Number(document.getElementById('facturaId')?.value||0);
  if(!id||!confirm('¿Eliminar definitivamente esta factura? Esta acción no se puede deshacer.'))return;
  const {error}=await supabaseClient.rpc('eliminar_factura',{p_id:id});
  if(error){console.error(error);alert('No se ha podido eliminar la factura. '+(error.message||''));return}
  document.getElementById('facturaForm')?.classList.add('hidden');
  await cargarFacturas();
  alert('Factura eliminada.');
}
function datosFactura(){return{id:document.getElementById('facturaId').value?Number(document.getElementById('facturaId').value):null,numero:document.getElementById('facturaNumero').textContent,fecha:document.getElementById('facturaFecha').value,eventoId:document.getElementById('facturaEvento').value?Number(document.getElementById('facturaEvento').value):null,estado:document.getElementById('facturaEstado').value,cliente:document.getElementById('facturaCliente').value.trim(),cif:document.getElementById('facturaCif').value.trim(),email:document.getElementById('facturaEmail').value.trim(),direccion:document.getElementById('facturaDireccion').value.trim(),concepto:document.getElementById('facturaConcepto').value.trim(),importe:Number(document.getElementById('facturaImporte').value||0),iva:document.getElementById('facturaIva').value,fundamento:document.getElementById('facturaFundamento').value.trim(),notas:document.getElementById('facturaNotas').value.trim()}}
async function guardarFactura(){
  const d=datosFactura(),msg=document.getElementById('facturaMensaje');if(!d.cliente||!d.concepto||!d.fecha){msg.textContent='⚠️ Completa fecha, cliente y concepto.';return false}msg.textContent='Guardando…';
  const boton=document.getElementById('staGuardarFactura');
  if(boton.disabled)return false;
  boton.disabled=true;
  try{
  const {data,error}=await supabaseClient.rpc('guardar_factura',{p_id:d.id,p_fecha_emision:d.fecha,p_evento_id:d.eventoId,p_cliente:d.cliente,p_cif_nif:d.cif,p_direccion:d.direccion,p_email:d.email,p_concepto:d.concepto,p_importe:d.importe,p_tratamiento_iva:d.iva,p_fundamento_iva:d.fundamento,p_estado:d.estado,p_notas:d.notas});
  if(error){console.error(error);msg.textContent='❌ No se ha podido guardar. '+(error.message||'');return false}
  const f=(Array.isArray(data)?data[0]:data)||null;if(f){document.getElementById('facturaId').value=String(f.id);document.getElementById('facturaNumero').textContent=f.numero||'Factura';document.getElementById('facturaGuardado').textContent='Guardada'}msg.textContent='✅ Factura guardada.';await cargarFacturas();return true
  }catch(error){
    console.error('Error guardando factura',error);
    msg.textContent='No se pudo confirmar el guardado. Consulta la lista de facturas antes de reintentar.';
    return false;
  }finally{boton.disabled=false;}
}
function imprimirFactura(){
  const d=datosFactura();if(!d.cliente||!d.concepto){alert('Completa cliente y concepto.');return}const em=datosEmisorForm();guardarDatosEmisor(em);const w=window.open('','_blank');if(!w){alert('El navegador ha bloqueado la ventana de impresión.');return}
  const safe=x=>escapeHtml(String(x||'')),ivaTxt=d.iva==='exento'?'Exenta de IVA':d.iva==='no_sujeto'?'Operación no sujeta':'IVA general';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(d.numero||'Factura')} · Spirit to All</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;max-width:780px;margin:36px auto;padding:28px}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:4px solid #ff7900;padding-bottom:18px}.top h1{margin:0;font-size:30px}.muted{color:#6b7280}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0}.box{border:1px solid #e5e7eb;border-radius:12px;padding:15px}.total{margin:24px 0;text-align:right;font-size:28px;font-weight:900}.fiscal{background:#f7f7f8;border-radius:12px;padding:14px;margin:18px 0}.sign{margin-top:56px;border-top:1px solid #ddd;padding-top:12px;color:#666;font-size:12px}.foot{margin-top:45px;color:#777;font-size:11px}@media print{body{margin:0}}
/* V18 · Centro de informes */
.sta-report-hub{display:grid;gap:12px}.sta-report-card{width:100%;text-align:left;border:1px solid #dedede;border-radius:20px;background:#fff;padding:18px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;box-shadow:0 8px 22px rgba(0,0,0,.06);font:inherit;color:#18181a}.sta-report-card:active{transform:scale(.995)}.sta-report-card .ico{font-size:2rem}.sta-report-card strong{display:block;font-size:1.08rem}.sta-report-card small{display:block;color:#6b7280;margin-top:4px;line-height:1.35}.sta-report-card b{font-size:1.45rem;color:#ff7900}.sta-report-search{margin:14px 0}.sta-report-search input{width:100%;border:1px solid #d7d9dd;border-radius:16px;padding:14px 16px;font:inherit;background:#fff}.sta-report-result{width:100%;text-align:left;border:1px solid #e1e3e6;border-radius:16px;background:#fff;padding:14px 16px;margin:8px 0;font:inherit;color:#1f2024}.sta-report-result.selected{border:2px solid #ff7900;background:#fff7ed}.sta-report-result strong,.sta-report-result small{display:block}.sta-report-result small{color:#70757f;margin-top:4px}.sta-report-note{font-size:.9rem;color:#666;line-height:1.4;margin-top:8px}
.sta-report-search-pro{margin:14px 0 10px}
.sta-report-results-pro{display:grid;gap:9px;margin-top:8px;padding-bottom:6px}
.sta-report-result-pro{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important;margin:0!important;padding:14px 15px!important;border:1px solid #e2e4e8!important;background:#fff!important;box-shadow:0 3px 10px rgba(0,0,0,.035)!important}
.sta-report-result-pro strong{font-size:15px!important;line-height:1.2!important}.sta-report-result-pro small{font-size:12px!important;line-height:1.35!important;color:#71717a!important}.sta-report-result-pro.selected{border:2px solid #ff7900!important;background:#fff8ef!important}
.sta-report-result-copy{min-width:0}.sta-report-result-chevron{font-size:25px;color:#ff7900;font-weight:500;line-height:1}
.sta-report-search-placeholder,.sta-report-empty-search{border:1px dashed #d7d9de;border-radius:16px;background:#fafafa;padding:24px 18px;text-align:center;color:#6b7280}
.sta-report-search-placeholder span{display:block;font-size:28px;margin-bottom:8px}.sta-report-search-placeholder strong{display:block;color:#282a2e;font-size:14px;margin-bottom:5px}.sta-report-search-placeholder small{display:block;font-size:12px;line-height:1.4}
.sta-report-selected-pro{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;border:1px solid #ffd4ad;background:#fff7ed;border-radius:15px;padding:12px 13px;margin:8px 0 12px}.sta-report-selected-check{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#15803d;color:#fff;font-weight:900}
.sta-report-selected-pro small,.sta-report-selected-pro strong,.sta-report-selected-pro em{display:block}.sta-report-selected-pro small{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9a5b23;font-weight:900}.sta-report-selected-pro strong{font-size:14px;margin-top:2px}.sta-report-selected-pro em{font-size:11px;color:#6b7280;font-style:normal;margin-top:2px}.sta-report-selected-pro button{background:transparent;border:0;padding:5px 7px;font-size:24px;color:#7a7a7a;box-shadow:none}.sta-report-state-pro{font-size:12px;color:#6b7280;margin:8px 2px 0}

</style>
<style id="sta-v21-fixed-screen-nav">
/* V21 · navegación fija y siempre visible en Mis encuestas y Redes */
.sta-fixed-screen-nav{display:none;position:fixed;top:0;left:0;right:0;z-index:9000;height:64px;padding:10px 14px;grid-template-columns:76px minmax(0,1fr) 76px;align-items:center;gap:8px;background:#fff;border-bottom:1px solid #e5e7eb;box-shadow:0 2px 10px rgba(0,0,0,.06);box-sizing:border-box;padding-top:max(10px,env(safe-area-inset-top))}
.sta-fixed-screen-nav.visible{display:grid!important}
.sta-fixed-screen-nav strong{text-align:center;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sta-fixed-screen-nav button{border:0;background:transparent;color:#e76f00;font:inherit;font-size:14px;font-weight:900;padding:10px 4px;white-space:nowrap}
#misEncuestas.sta-standalone-screen,#accesosSpirit.sta-standalone-screen{padding-top:78px!important}
#misEncuestas.sta-standalone-screen>.sta-standalone-bar,#accesosSpirit.sta-standalone-screen>.sta-standalone-bar{display:none!important}
@media(max-width:380px){.sta-fixed-screen-nav{grid-template-columns:68px minmax(0,1fr) 68px;padding-left:8px;padding-right:8px}.sta-fixed-screen-nav strong{font-size:16px}.sta-fixed-screen-nav button{font-size:13px}}
</style>

<style id="sta-manual-user-style">
.sta-home-action-manual{border-style:dashed!important}
.sta-manual-hero{background:linear-gradient(145deg,#1d1e22,#27282d);color:#fff;border-radius:18px;padding:18px;margin-bottom:14px;border-left:6px solid var(--naranja)}
.sta-manual-hero strong{display:block;font-size:20px;margin-bottom:6px}.sta-manual-hero p{margin:0;color:#e8e8e8;line-height:1.45}
.sta-manual-tools{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 16px}.sta-manual-tools a{display:flex;align-items:center;justify-content:center;text-align:center;min-height:46px;text-decoration:none;font-weight:900}
.sta-manual-search{margin:0 0 14px}.sta-manual-search input{margin:0}
.sta-manual-list{display:grid;gap:10px}.sta-manual-section{border:1px solid #e3e5e8;border-radius:14px;background:#fff;overflow:hidden}.sta-manual-section[open]{border-color:#f4b16d;box-shadow:0 5px 16px rgba(0,0,0,.05)}
.sta-manual-section summary{cursor:pointer;list-style:none;padding:14px 16px;font-weight:900;font-size:15px;display:flex;align-items:center;gap:9px}.sta-manual-section summary::-webkit-details-marker{display:none}.sta-manual-section summary:after{content:'›';margin-left:auto;font-size:23px;line-height:1;transition:transform .15s ease}.sta-manual-section[open] summary:after{transform:rotate(90deg)}
.sta-manual-body{padding:0 16px 16px;color:#3e434b;line-height:1.48;font-size:14px}.sta-manual-body p{margin:8px 0}.sta-manual-body ul,.sta-manual-body ol{margin:8px 0 8px 20px;padding:0}.sta-manual-body li{margin:5px 0}.sta-manual-tip{background:#fff7ed;border-left:4px solid var(--naranja);padding:10px 12px;border-radius:10px;margin:10px 0}.sta-manual-warning{background:#fff1f2;border-left:4px solid #dc2626;padding:10px 12px;border-radius:10px;margin:10px 0}.sta-manual-role{display:inline-flex;padding:3px 8px;border-radius:999px;background:#f3f4f6;font-size:11px;font-weight:900;margin-right:4px}.sta-manual-empty{padding:18px;text-align:center;color:#6b7280;background:#fff;border-radius:14px;border:1px dashed #d1d5db}
@media(max-width:420px){.sta-manual-tools{grid-template-columns:1fr}.sta-manual-section summary{font-size:14px}}
</style>
</head><body><div class="top"><div><img src="logo-header.png" style="max-width:170px;max-height:80px"><div class="muted">${safe(em.nombre||'Spirit to All')}</div>${em.cif?`<div class="muted">CIF ${safe(em.cif)}</div>`:''}${em.direccion?`<div class="muted">${safe(em.direccion)}</div>`:''}</div><div style="text-align:right"><h1>FACTURA</h1><strong>${safe(d.numero||'Pendiente de guardar')}</strong><div class="muted">${safe(formatearFechaCorta(d.fecha||''))}</div></div></div><div class="grid"><div class="box"><strong>Facturar a</strong><br>${safe(d.cliente)}${d.cif?`<br>CIF/NIF: ${safe(d.cif)}`:''}${d.direccion?`<br>${safe(d.direccion).replace(/\n/g,'<br>')}`:''}</div><div class="box"><strong>Concepto</strong><br>${safe(d.concepto).replace(/\n/g,'<br>')}</div></div><div class="fiscal"><strong>Base / importe:</strong> ${safe(eur(d.importe))}<br><strong>Tratamiento IVA:</strong> ${safe(ivaTxt)}${d.fundamento?`<br><strong>Fundamento / observación:</strong> ${safe(d.fundamento)}`:''}</div><div class="total">TOTAL: ${safe(eur(d.importe))}</div>${d.notas?`<div class="box"><strong>Notas</strong><br>${safe(d.notas).replace(/\n/g,'<br>')}</div>`:''}<div class="sign">Documento preparado para firma digital con el certificado de la asociación. La firma criptográfica debe aplicarse al PDF con AutoFirma, Adobe Acrobat u otra herramienta compatible.</div><div class="foot">Factura generada desde la aplicación privada de gestión de Spirit to All.</div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close()
}
function prepararCorreoFactura(){const d=datosFactura();const asunto=`Factura ${d.numero||''} · Spirit to All`;const cuerpo=`Buenos días:\n\nAdjuntamos la factura ${d.numero||''} correspondiente a ${d.concepto||'la actuación'}.\n\nImporte: ${eur(d.importe)}\n\nUn saludo,\nSpirit to All`;location.href=`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`}


// =========================================================
// V19 · REDES CONFIGURABLES + HISTORIAL DE INFORMES
// =========================================================
const STA_REDES_FALLBACK=[
  {id:null,nombre:'Web Spirit to All',url:'https://www.spirittoall.com',icono:'🌐',color:'#ff7900',orden:10,activa:true},
  {id:null,nombre:'Instagram',url:'https://www.instagram.com/spirit_to_all?stkn=aW04cm9kNjdycTg=',icono:'📸',color:'#e1306c',orden:20,activa:true},
  {id:null,nombre:'YouTube',url:'https://youtube.com/@spirittoall?si=rx38S3hxWqQfhOyB',icono:'▶️',color:'#ff0000',orden:30,activa:true}
];
let staRedesSociales=[];
function staUrlSegura(url){try{const u=new URL(String(url||''));return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch(_){return '#'}}
function staColorSeguro(c){return /^#[0-9a-f]{6}$/i.test(String(c||''))?String(c):'#ff7900'}
function staEtiquetaRedUrl(url){try{const u=new URL(String(url||''));return u.hostname.replace(/^www\./,'')||'Abrir enlace'}catch(_){return 'Abrir enlace'}}
async function cargarRedesSociales(){
  const lista=document.getElementById('staRedesLista'),gestion=document.getElementById('staRedesGestion');if(!lista)return;
  lista.innerHTML='<p class="muted">Cargando redes…</p>';
  try{
    const {data,error}=await supabaseClient.rpc('listar_redes_sociales');
    if(error)throw error;
    staRedesSociales=(data||[]).map(x=>({...x,activa:x.activa!==false}));
  }catch(e){console.warn('Redes configurables no disponibles todavía; usando accesos base.',e);staRedesSociales=STA_REDES_FALLBACK.slice()}
  const visibles=staRedesSociales.filter(x=>x.activa!==false).sort((a,b)=>Number(a.orden||0)-Number(b.orden||0));
  lista.innerHTML=visibles.length?visibles.map(r=>`<a class="sta-red-social" style="--sta-red-color:${staColorSeguro(r.color)}" href="${escapeHtml(staUrlSegura(r.url))}" target="_blank" rel="noopener noreferrer"><span class="ico">${escapeHtml(r.icono||'🔗')}</span><span class="sta-red-copy"><strong>${escapeHtml(r.nombre||'Enlace')}</strong><small>${escapeHtml(staEtiquetaRedUrl(r.url))}</small></span><span class="chev">›</span></a>`).join(''):'<div class="sta-empty-state">No hay redes activas.</div>';
  gestion?.classList.toggle('hidden',!esGestor());
  if(staTienePermiso('redes'))lista.insertAdjacentHTML('beforeend',`<div class="sta-red-admin-wrap"><strong>Administrar redes</strong>${staRedesSociales.sort((a,b)=>Number(a.orden||0)-Number(b.orden||0)).map(r=>`<div class="sta-red-admin-row"><span><strong><span class="sta-red-dot" style="background:${staColorSeguro(r.color)}"></span>${escapeHtml(r.icono||'🔗')} ${escapeHtml(r.nombre||'Enlace')}</strong><small>${r.activa===false?'Oculta':'Visible'} · orden ${Number(r.orden||0)}</small></span><span class="actions"><button class="sta-mini-edit" type="button" onclick="abrirEditorRedSocial(${r.id??'null'})">Editar</button></span></div>`).join('')}</div>`);
}
function staRedIconosOptions(actual){const icons=['🌐','📸','▶️','🎵','🎶','💬','📘','𝕏','💼','🔗','📣','🎧'];return icons.map(i=>`<option value="${i}" ${i===actual?'selected':''}>${i}</option>`).join('')}
function abrirEditorRedSocial(id=null){
  if(!staTienePermiso('redes'))return;const r=id==null?{id:null,nombre:'',url:'https://',icono:'🔗',color:'#ff7900',orden:(Math.max(0,...staRedesSociales.map(x=>Number(x.orden||0)))+10),activa:true}:staRedesSociales.find(x=>Number(x.id)===Number(id));if(!r)return;
  abrirStaSheet(id==null?'Añadir red':'Editar red',`<div class="sta-sheet-intro"><strong>${id==null?'Nueva red o enlace':'Configura este acceso'}</strong><p>Puedes añadir TikTok u otra plataforma sin volver a modificar el código.</p></div><div class="sta-red-form"><input id="staRedId" type="hidden" value="${r.id??''}"><label class="control-label">Nombre<input id="staRedNombre" type="text" value="${escapeHtml(r.nombre||'')}" placeholder="Ej. TikTok"></label><label class="control-label">Enlace<input id="staRedUrl" type="url" value="${escapeHtml(r.url||'https://')}" placeholder="https://..."></label><div class="sta-red-icon-grid"><label class="control-label">Icono<select id="staRedIcono">${staRedIconosOptions(r.icono||'🔗')}</select></label><label class="control-label">Orden<input id="staRedOrden" type="number" min="0" step="1" value="${Number(r.orden||0)}"></label></div><div class="sta-color-row"><label class="control-label">Color<input id="staRedColorTxt" type="text" value="${staColorSeguro(r.color)}" pattern="#[0-9A-Fa-f]{6}" oninput="document.getElementById('staRedColor').value=staColorSeguro(this.value)"></label><label class="control-label">Elegir<input id="staRedColor" type="color" value="${staColorSeguro(r.color)}" oninput="document.getElementById('staRedColorTxt').value=this.value"></label></div><label class="control-label"><span style="display:flex;gap:9px;align-items:center"><input id="staRedActiva" type="checkbox" ${r.activa!==false?'checked':''} style="width:auto"> Visible para los miembros</span></label><button class="sta-action-primary" type="button" onclick="guardarRedSocial()">Guardar red</button>${r.id!=null?'<button class="btn-no btn-full" type="button" onclick="eliminarRedSocial()">Eliminar red</button>':''}</div>`,'history');
}
async function guardarRedSocial(){
  if(!staTienePermiso('redes'))return;const id=Number(document.getElementById('staRedId')?.value)||null,nombre=document.getElementById('staRedNombre')?.value.trim(),url=document.getElementById('staRedUrl')?.value.trim(),icono=document.getElementById('staRedIcono')?.value||'🔗',color=staColorSeguro(document.getElementById('staRedColorTxt')?.value),orden=Number(document.getElementById('staRedOrden')?.value||0),activa=!!document.getElementById('staRedActiva')?.checked;
  if(!nombre||!url||staUrlSegura(url)==='#'){alert('Escribe un nombre y un enlace válido que empiece por https://');return}
  const {error}=await supabaseClient.rpc('guardar_red_social',{p_id:id,p_nombre:nombre,p_url:url,p_icono:icono,p_color:color,p_orden:orden,p_activa:activa});if(error){console.error(error);alert('No se ha podido guardar. Ejecuta primero el SQL de redes configurables en Supabase.');return}
  cerrarStaSheet();await cargarRedesSociales();staAbrirPantallaInicio('accesosSpirit');
}
async function eliminarRedSocial(){
  if(!staTienePermiso('redes'))return;const id=Number(document.getElementById('staRedId')?.value);if(!id||!confirm('¿Eliminar esta red de Spirit to All?'))return;const {error}=await supabaseClient.rpc('eliminar_red_social',{p_id:id});if(error){console.error(error);alert('No se ha podido eliminar.');return}cerrarStaSheet();await cargarRedesSociales();staAbrirPantallaInicio('accesosSpirit');
}
// =========================================================
// CONTACTO COMERCIAL · correo preparado para captación
// =========================================================
function staRedComercial(...claves){
  const visibles=(staRedesSociales||[]).filter(r=>r&&r.activa!==false&&staUrlSegura(r.url)!=='#');
  const norm=v=>staNormalizarBusqueda(v||'');
  for(const clave of claves){
    const c=norm(clave);
    const encontrada=visibles.find(r=>norm(r.nombre).includes(c)||norm(r.url).includes(c));
    if(encontrada)return encontrada;
  }
  return null;
}
function staRedesComerciales(){
  const web=staRedComercial('web','pagina','sitio');
  const instagram=staRedComercial('instagram','ig');
  const youtube=staRedComercial('youtube','youtu.be');
  return [
    web?{icono:'🌐',nombre:'Web',url:staUrlSegura(web.url)}:null,
    instagram?{icono:'📸',nombre:'Instagram',url:staUrlSegura(instagram.url)}:null,
    youtube?{icono:'▶️',nombre:'YouTube',url:staUrlSegura(youtube.url)}:null
  ].filter(Boolean);
}
function staTextoRedesComerciales(){
  const redes=staRedesComerciales();
  return redes.length?redes.map(r=>`${r.icono} ${r.nombre}: ${r.url}`).join('\n'):'Nuestros canales oficiales están disponibles en la app de Spirit to All.';
}
function staRedesComercialesHtml(){
  const redes=staRedesComerciales();
  return redes.length?`<div class="sta-commercial-network-list">${redes.map(r=>`<div>${escapeHtml(r.icono)} <strong>${escapeHtml(r.nombre)}:</strong> ${escapeHtml(r.url)}</div>`).join('')}</div>`:'<p class="muted" style="margin-top:8px">No se han encontrado todavía Web, Instagram o YouTube entre las redes activas.</p>';
}
function staPlantillaComercialDatos(){
  return {
    email:document.getElementById('staComercialEmail')?.value.trim()||'',
    empresa:document.getElementById('staComercialEmpresa')?.value.trim()||'',
    contacto:document.getElementById('staComercialContacto')?.value.trim()||'',
    tipo:document.getElementById('staComercialTipo')?.value||'general',
    cache:document.getElementById('staComercialCache')?.value.trim()||'1.950 €',
    zona:document.getElementById('staComercialZona')?.value.trim()||'Madrid y alrededores'
  };
}
function staCrearPlantillaComercial(d){
  const destinatario=d.contacto?` ${d.contacto}`:'';
  const empresa=d.empresa?` de ${d.empresa}`:'';
  const saludo=`Buenos días${destinatario}:`;
  const precio=`Nuestro caché de referencia para actuaciones en ${d.zona} es de ${d.cache}, sujeto a las características concretas del evento.`;
  const dossier='Adjuntamos nuestro dossier para que puedan conocer con más detalle nuestra propuesta artística, formato y repertorio.';
  const redes=staTextoRedesComerciales();
  let asunto='Spirit to All · propuesta musical';
  let apertura='Nos ponemos en contacto con ustedes desde Spirit to All, formación vocal de gospel y soul, para presentarles nuestra propuesta musical para eventos, celebraciones y actuaciones.';
  let cierre='Quedamos a su disposición para ampliar cualquier información o preparar una propuesta adaptada a sus necesidades.';
  if(d.tipo==='empresa'){
    asunto='Spirit to All · propuesta para eventos y empresas';
    apertura=`Nos ponemos en contacto con ustedes${empresa} desde Spirit to All, formación vocal de gospel y soul, para valorar posibles colaboraciones en eventos corporativos, celebraciones, galas y encuentros especiales.`;
    cierre='Estaremos encantados de valorar fechas, formato y necesidades técnicas para preparar una propuesta adaptada a su evento.';
  }else if(d.tipo==='cultura'){
    asunto='Spirit to All · propuesta para programación cultural';
    apertura=`Nos ponemos en contacto con ustedes${empresa} desde Spirit to All, formación vocal de gospel y soul, para presentarles una propuesta artística que puede encajar en programación cultural, fiestas, teatros, centros culturales y eventos institucionales.`;
    cierre='Quedamos a su disposición para facilitar información técnica, disponibilidad y una propuesta adaptada a su programación.';
  }
  const cuerpo=`${saludo}\n\n${apertura}\n\n${precio}\n\n${dossier}\n\nTambién pueden conocer nuestro trabajo a través de nuestros canales:\n${redes}\n\n${cierre}\n\nUn saludo,\nSpirit to All`;
  return {asunto,cuerpo};
}
function staActualizarPlantillaComercial(){
  const d=staPlantillaComercialDatos(),p=staCrearPlantillaComercial(d);
  const asunto=document.getElementById('staComercialAsunto'),texto=document.getElementById('staComercialTexto');
  if(asunto)asunto.value=p.asunto;
  if(texto)texto.value=p.cuerpo;
}
async function abrirContactoComercial(){
  if(!staTienePermiso('comercial'))return;
  if(!(staRedesSociales||[]).length){try{await cargarRedesSociales()}catch(_){}}
  const redesHtml=staRedesComercialesHtml();
  abrirStaSheet('Contacto comercial',`<div class="sta-sheet-intro"><strong>✉️ Captación de clientes</strong><p>Prepara un correo profesional, revísalo y ábrelo en Gmail o en la app de correo del dispositivo.</p></div>
  <div class="sta-commercial-card"><h3>Datos del contacto</h3><p>Solo el correo es obligatorio. El resto sirve para personalizar el mensaje.</p><div class="sta-commercial-grid" style="margin-top:10px"><label class="control-label">Correo de destino<input id="staComercialEmail" type="email" inputmode="email" placeholder="contacto@empresa.com"></label><label class="control-label">Empresa / entidad<input id="staComercialEmpresa" type="text" placeholder="Nombre de la empresa"></label><label class="control-label">Persona de contacto<input id="staComercialContacto" type="text" placeholder="Nombre (opcional)"></label><label class="control-label">Plantilla<select id="staComercialTipo" onchange="staActualizarPlantillaComercial()"><option value="general">Presentación general</option><option value="empresa">Empresas y eventos</option><option value="cultura">Ayuntamientos y cultura</option></select></label><label class="control-label">Caché de referencia<input id="staComercialCache" type="text" value="1.950 €" oninput="staActualizarPlantillaComercial()"></label><label class="control-label">Zona<input id="staComercialZona" type="text" value="Madrid y alrededores" oninput="staActualizarPlantillaComercial()"></label></div></div>
  <div class="sta-commercial-card"><h3>Canales incluidos</h3><p>Se toman automáticamente de las redes configuradas en la app.</p>${redesHtml}</div>
  <div class="sta-commercial-warning"><strong>📎 Antes de enviar:</strong> Gmail no permite que esta web adjunte automáticamente el dossier. Cuando se abra el correo, pulsa el clip y añade el dossier de Spirit to All antes de enviarlo.</div>
  <div class="sta-commercial-preview"><label class="control-label">Asunto<input id="staComercialAsunto" type="text"></label><label class="control-label">Texto del correo<textarea id="staComercialTexto" rows="16"></textarea></label><small class="muted">Puedes modificar libremente el asunto y el texto antes de abrir Gmail.</small></div>
  <div class="sta-commercial-signature"><img src="logo-header.png" alt="Logo Spirit to All"><small>Firma visual de Spirit to All. La imagen se muestra aquí como referencia.</small></div>
  <div class="sta-commercial-warning"><strong>Sobre el logo en Gmail:</strong> el correo se abre mediante el sistema estándar <em>mailto</em>, que solo permite enviar texto. Para que el logo aparezca realmente dentro del correo, debe estar configurado como firma de la cuenta de Gmail. Si esa firma está activa, Gmail puede añadirla al redactar.</div>
  <div class="sta-save-dock"><button class="sta-action-primary" type="button" onclick="staAbrirCorreoComercial()">✉️ Abrir correo preparado</button></div>`,'history');
  staActualizarPlantillaComercial();
}
function staAbrirCorreoComercial(){
  if(!esGestor())return;
  const d=staPlantillaComercialDatos();
  if(!d.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)){alert('Escribe un correo electrónico válido.');document.getElementById('staComercialEmail')?.focus();return}
  const asunto=document.getElementById('staComercialAsunto')?.value.trim()||'Spirit to All · propuesta musical';
  const cuerpo=document.getElementById('staComercialTexto')?.value.trim()||staCrearPlantillaComercial(d).cuerpo;
  const ok=confirm('Se abrirá Gmail o tu aplicación de correo con el mensaje preparado.\n\nIMPORTANTE: antes de enviarlo, adjunta el dossier de Spirit to All con el icono del clip.\n\n¿Continuar?');
  if(!ok)return;
  location.href=`mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

async function staRegistrarInforme(tipo,titulo,parametros){
  try{const {error}=await supabaseClient.rpc('registrar_informe_generado',{p_tipo:tipo,p_titulo:titulo,p_parametros:parametros||{}});if(error)console.warn('No se ha registrado el informe en el historial.',error)}catch(e){console.warn(e)}
}
let staInformeBusquedaTimer=null;
function staCentroInformesHtml(tab='crear'){
  const crear=tab!=='buscar';
  return `<div class="sta-sheet-intro"><strong>Informes y exportaciones</strong><p>Crea informes Excel editables y envíalos desde el móvil o descárgalos cuando lo necesites.</p></div><div class="sta-report-tabs"><button class="sta-report-tab ${crear?'active':''}" type="button" onclick="staCambiarCentroInformes('crear')">Crear informe</button><button class="sta-report-tab ${!crear?'active':''}" type="button" onclick="staCambiarCentroInformes('buscar')">Buscar informes</button></div><div id="staCentroInformesContenido">${crear?staCentroInformesCrearHtml():staCentroInformesBuscarHtml()}</div>`
}
function staCentroInformesCrearHtml(){return `<div class="sta-report-section-title">Informes de actividad</div><div class="sta-report-hub"><button class="sta-report-card annual" type="button" onclick="abrirInformeAnualEventos()"><span class="ico">📈</span><span><strong>Informe anual de eventos</strong><small>Dashboard ejecutivo, porcentajes, evolución mensual, estados y relación completa de eventos del año.</small></span><b>›</b></button><button class="sta-report-card" type="button" onclick="abrirInformeAsistenciaDesdeCentro()"><span class="ico">📊</span><span><strong>Asistencia · varias encuestas</strong><small>Resumen por evento y persona, porcentajes y detalle de fechas.</small></span><b>›</b></button></div><div class="sta-report-section-title" style="margin-top:20px">Control operativo</div><div class="sta-report-hub"><button class="sta-report-card" type="button" onclick="abrirInformeUnaEncuesta()"><span class="ico">📋</span><span><strong>Control de participantes</strong><small>Disponibilidad, asistencia real y relación persona a persona de una encuesta.</small></span><b>›</b></button></div><p class="sta-report-note"><strong>Excel profesional y editable.</strong><br>Hojas separadas, filtros y formato compatible con Microsoft Excel. Si usas Edge, Microsoft 365, Excel u Outlook en el móvil, también puedes usar <strong>Abrir / compartir</strong> para entregar el XLSX directamente al sistema.</p>`}
function staCentroInformesBuscarHtml(){return `<div class="sta-report-search"><input id="staBuscarInformesInput" type="search" placeholder="Buscar por título, tipo o fecha…" oninput="staBuscarInformesDebounced(this.value)"></div><div id="staHistorialInformes" class="sta-report-history-list"><p class="muted">Cargando historial…</p></div><p class="sta-report-note">El historial guarda la configuración del informe, no una copia pesada del Excel. Puedes regenerarlo cuando quieras con los datos actuales.</p>`}
function staCambiarCentroInformes(tab){const c=document.getElementById('staSheetBody');if(!c)return;c.innerHTML=staCentroInformesHtml(tab);if(tab==='buscar')cargarHistorialInformes('')}
function staBuscarInformesDebounced(v){clearTimeout(staInformeBusquedaTimer);staInformeBusquedaTimer=setTimeout(()=>cargarHistorialInformes(v||''),220)}
async function cargarHistorialInformes(busqueda=''){
  const box=document.getElementById('staHistorialInformes');if(!box)return;box.innerHTML='<p class="muted">Buscando…</p>';
  try{const {data,error}=await supabaseClient.rpc('listar_informes_generados',{p_busqueda:busqueda||null});if(error)throw error;const arr=data||[];box.innerHTML=arr.length?arr.map(r=>`<div class="sta-report-history-row"><div class="sta-report-history-top"><span><strong>${escapeHtml(r.titulo||'Informe')}</strong><small>${escapeHtml(r.tipo||'')} · ${escapeHtml(formatearFechaHoraInforme(r.created_at))}${r.creado_por_nombre?' · '+escapeHtml(r.creado_por_nombre):''}</small></span><span class="badge">${r.tipo==='eventos_anual'?'📈':r.tipo==='asistencia_multiple'?'📊':'📋'}</span></div><div class="sta-report-history-actions"><button class="btn-light" type="button" onclick='regenerarInformeHistorial(${JSON.stringify(JSON.stringify(r.parametros||{}))},${JSON.stringify(r.tipo||'')})'>Volver a generar</button></div></div>`).join(''):'<div class="sta-empty-state">No hay informes que coincidan con la búsqueda.</div>'}catch(e){console.error(e);box.innerHTML='<div class="sta-empty-state">Todavía no está activo el historial de informes. Ejecuta el SQL de Supabase que te he preparado.</div>'}
}
function formatearFechaHoraInforme(v){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch(_){return String(v||'')}}
async function regenerarInformeHistorial(parametrosJson,tipo){
  let p={};try{p=JSON.parse(parametrosJson||'{}')}catch(_){p={}}
  if(tipo==='control_participantes'&&Number(p.fecha_evento_id)){staInformeUnaFechaSeleccionada=Number(p.fecha_evento_id);await generarInformeUnaEncuesta(true);return}
  if(tipo==='asistencia_multiple'&&Array.isArray(p.fecha_evento_ids)){staInformeSeleccion=new Set(p.fecha_evento_ids.map(String));await generarInformeAsistencia(true,p.anio||'seleccion');return}
  if(tipo==='eventos_anual'&&p.anio){await generarInformeAnualEventos(String(p.anio),true,'download');return}
  alert('Este informe antiguo no contiene parámetros suficientes para regenerarlo.');
}

// =========================================================
// INFORME ANUAL DE EVENTOS · dashboard profesional
// =========================================================
function staAniosEventosDisponibles(){const a=String(new Date().getFullYear()),ys=[...new Set((eventosActuales||[]).map(e=>String(e.fecha||'').slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort((x,y)=>y.localeCompare(x));if(!ys.includes(a))ys.unshift(a);return ys}
function staEventosAnio(a){return (eventosActuales||[]).filter(e=>!e.eliminado&&String(e.fecha||'').startsWith(String(a))).sort((x,y)=>String(x.fecha||'').localeCompare(String(y.fecha||'')))}
function staEstadoNombre(e){return({abierto:'Abierto',confirmado:'Confirmado',cancelado:'Cancelado',finalizado:'Finalizado'})[e]||String(e||'Sin estado')}
function staMesNombre(n){return['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][n-1]||''}
function staResumenAnual(a){const ev=staEventosAnio(a),total=ev.length,c=s=>ev.filter(e=>e.estado===s).length,p=n=>total?Math.round(n*1000/total)/10:0;return{ev,total,fin:c('finalizado'),can:c('cancelado'),con:c('confirmado'),abi:c('abierto'),pFin:p(c('finalizado')),pCan:p(c('cancelado')),pCon:p(c('confirmado')),pAbi:p(c('abierto'))}}
function abrirInformeAnualEventos(){const y=staAniosEventosDisponibles()[0]||String(new Date().getFullYear());pushStaSheet('Informe anual de eventos',staInformeAnualHtml(y),'history')}
function staInformeAnualHtml(y){const ys=staAniosEventosDisponibles(),r=staResumenAnual(y),pc=v=>Number(v).toFixed(1).replace('.',',')+'%';return `<div class="sta-sheet-intro"><strong>Actividad anual de Spirit to All</strong><p>Indicadores, porcentajes, evolución mensual y relación completa de eventos.</p></div><label class="control-label">Año<select id="staInformeAnualYear" onchange="staCambiarInformeAnualYear(this.value)">${ys.map(a=>`<option ${a==y?'selected':''}>${a}</option>`).join('')}</select></label><div class="sta-annual-preview"><div class="sta-annual-kpi orange"><strong>${r.total}</strong><small>Eventos del año</small></div><div class="sta-annual-kpi green"><strong>${pc(r.pFin)}</strong><small>Finalizados · ${r.fin}</small></div><div class="sta-annual-kpi red"><strong>${pc(r.pCan)}</strong><small>Cancelados · ${r.can}</small></div><div class="sta-annual-kpi"><strong>${pc(r.pCon)}</strong><small>Confirmados · ${r.con}</small></div></div><div class="sta-annual-status">Excel con <strong>Dashboard</strong>, <strong>Eventos</strong>, <strong>Por estado</strong> y <strong>Por mes</strong>, porcentajes, filtros y cabeceras congeladas.</div><div class="sta-report-email-box"><label class="control-label">Correo de destino<input id="staInformeAnualEmail" type="email" inputmode="email" placeholder="nombre@correo.com"></label><small>Al pulsar «Enviar informe», el XLSX se guardará en el dispositivo y se abrirá Gmail/correo con destinatario, asunto y texto preparados. Adjunta el archivo descargado, revisa el mensaje y envíalo.</small></div><div class="sta-save-dock"><button class="sta-action-primary" onclick="generarInformeAnualEventos(null,false,'email')">✉️ Enviar informe</button><button class="btn-light btn-full" onclick="generarInformeAnualEventos(null,false,'download')">⬇️ Descargar Excel</button><button class="btn-light btn-full" onclick="generarInformeAnualEventos(null,false,'share')">📤 Abrir / compartir</button></div>`}
function staCambiarInformeAnualYear(y){document.getElementById('staSheetBody').innerHTML=staInformeAnualHtml(y)}
async function generarInformeAnualEventos(anio=null,desdeHistorial=false,modo='download'){const y=String(anio||document.getElementById('staInformeAnualYear')?.value||new Date().getFullYear()),email=document.getElementById('staInformeAnualEmail')?.value?.trim()||'',r=staResumenAnual(y);if(modo==='email'&&(!email||!/^\S+@\S+\.\S+$/.test(email))){alert('Escribe un correo electrónico válido.');return}if(!r.total){alert(`No hay eventos registrados en ${y}.`);return}const body=document.getElementById('staSheetBody'),old=body?.innerHTML||'';if(body)body.innerHTML='<div class="sta-sheet-intro"><strong>Preparando informe anual…</strong><p>Calculando indicadores y porcentajes.</p></div>';try{const bytes=await staCrearXlsxAnualEventos(y,r.ev);const entrega=await staEntregarInformeExcel(bytes,`Spirit_to_All_Informe_Anual_Eventos_${y}.xlsx`,email,modo);if(!desdeHistorial)await staRegistrarInforme('eventos_anual',`Informe anual de eventos · ${y}`,{anio:y});if(body)body.innerHTML=old;if(entrega==='mail-opened')console.log('Excel guardado y correo abierto')}catch(e){console.error(e);if(body)body.innerHTML=old;alert('No se ha podido generar el informe anual. '+(e?.message||''))}}
const staDependenciasExportar={
  ExcelJS:'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  JSZip:'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
};
const staDescargasExportar=new Map();
function staCargarDependenciaExportar(nombre){
  if(window[nombre])return Promise.resolve();
  if(staDescargasExportar.has(nombre))return staDescargasExportar.get(nombre);
  const carga=new Promise((ok,fallo)=>{
    const script=document.createElement('script');
    script.src=staDependenciasExportar[nombre];
    script.onload=()=>window[nombre]?ok():fallo(new Error('La biblioteca de exportación no está disponible.'));
    script.onerror=()=>{script.remove();fallo(new Error('No se pudo cargar la exportación. Comprueba la conexión.'));};
    document.head.append(script);
  }).finally(()=>staDescargasExportar.delete(nombre));
  staDescargasExportar.set(nombre,carga);
  return carga;
}
async function staExcelNuevoLibro(){
 await staCargarDependenciaExportar('ExcelJS');
 const wb=new ExcelJS.Workbook();
 wb.creator='Spirit to All';wb.lastModifiedBy='Spirit to All';wb.created=new Date();wb.modified=new Date();
 wb.company='Spirit to All';wb.calcProperties.fullCalcOnLoad=false;wb.calcProperties.forceFullCalc=false;
 return wb;
}
function staExcelFecha(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):String(v||'')}
function staExcelArgb(hex){return 'FF'+String(hex||'').replace('#','').toUpperCase()}
const STA_XLSX={black:'171717',orange:'FF7900',orangeSoft:'FFF1E2',white:'FFFFFF',light:'F7F7F8',line:'D7D7DB',green:'EAF7EE',greenText:'176B3A',red:'FFECEC',redText:'A61B1B',grayText:'666666'};
function staExcelTitulo(ws,titulo,subtitulo,lastCol){
 ws.mergeCells(`A1:${lastCol}1`);ws.mergeCells(`A2:${lastCol}2`);
 const a=ws.getCell('A1'),b=ws.getCell('A2');a.value=titulo;b.value=subtitulo;
 a.font={name:'Aptos Display',size:18,bold:true,color:{argb:staExcelArgb(STA_XLSX.white)}};a.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.black)}};a.alignment={vertical:'middle',horizontal:'left'};
 b.font={name:'Aptos',size:11,bold:true,color:{argb:staExcelArgb(STA_XLSX.black)}};b.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.orangeSoft)}};b.alignment={vertical:'middle',horizontal:'left'};
 ws.getRow(1).height=30;ws.getRow(2).height=22;
}
function staExcelCabecera(row){
 row.height=24;row.eachCell(c=>{c.font={name:'Aptos',size:10,bold:true,color:{argb:staExcelArgb(STA_XLSX.white)}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.orange)}};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};c.border={top:{style:'thin',color:{argb:staExcelArgb(STA_XLSX.line)}},left:{style:'thin',color:{argb:staExcelArgb(STA_XLSX.line)}},bottom:{style:'thin',color:{argb:staExcelArgb(STA_XLSX.line)}},right:{style:'thin',color:{argb:staExcelArgb(STA_XLSX.line)}}}})
}
function staExcelFila(rowOrCells,idx){
 const cells=Array.isArray(rowOrCells)?rowOrCells:(()=>{const a=[];rowOrCells.eachCell(c=>a.push(c));return a})();
 cells.forEach(c=>{c.font={name:'Aptos',size:10,color:{argb:staExcelArgb(STA_XLSX.black)}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(idx%2?STA_XLSX.light:STA_XLSX.white)}};c.alignment={vertical:'top',wrapText:true};c.border={bottom:{style:'hair',color:{argb:staExcelArgb(STA_XLSX.line)}}}})
}
function staExcelConfigHoja(ws){ws.views=[{state:'frozen',ySplit:4,showGridLines:false}];ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};ws.pageMargins={left:0.35,right:0.35,top:0.55,bottom:0.55,header:0.2,footer:0.2}}
async function staExcelBytes(wb){const ab=await wb.xlsx.writeBuffer();return new Uint8Array(ab)}
function staExcelTablaSimple(wb,nombre,titulo,subtitulo,headers,rows,widths,percentCols=[],dateCols=[]){
 const ws=wb.addWorksheet(nombre,{properties:{tabColor:{argb:staExcelArgb(STA_XLSX.orange)}}});staExcelConfigHoja(ws);staExcelTitulo(ws,titulo,subtitulo,staCol(headers.length-1));
 ws.addRow([]);const hr=ws.addRow(headers);staExcelCabecera(hr);
 rows.forEach((vals,i)=>{const r=ws.addRow(vals);staExcelFila(r,i);percentCols.forEach(ci=>{const c=r.getCell(ci+1);if(typeof c.value==='number')c.numFmt='0.0%'});dateCols.forEach(ci=>{const c=r.getCell(ci+1);if(c.value instanceof Date)c.numFmt='dd/mm/yyyy'})});
 widths.forEach((w,i)=>ws.getColumn(i+1).width=w||16);const last=Math.max(4,4+rows.length);ws.autoFilter={from:{row:4,column:1},to:{row:last,column:headers.length}};return ws
}
async function staCrearXlsxAnualEventos(anio,eventos){
 const wb=await staExcelNuevoLibro(),total=eventos.length,c=s=>eventos.filter(e=>e.estado===s).length,p=n=>total?n/total:0;
 const meses=Array.from({length:12},(_,i)=>{const m=i+1,a=eventos.filter(e=>Number(String(e.fecha||'').slice(5,7))===m);return[staMesNombre(m),a.length,a.filter(e=>e.estado==='finalizado').length,a.filter(e=>e.estado==='cancelado').length,a.filter(e=>e.estado==='confirmado').length,a.filter(e=>e.estado==='abierto').length,total?a.length/total:0]});
 const dash=wb.addWorksheet('Dashboard',{properties:{tabColor:{argb:staExcelArgb(STA_XLSX.orange)}}});dash.views=[{showGridLines:false}];staExcelTitulo(dash,`SPIRIT TO ALL · INFORME ANUAL ${anio}`,'Dashboard ejecutivo · actividad anual de eventos','G');
 dash.getCell('A4').value='INDICADOR';dash.getCell('B4').value='RESULTADO';dash.getCell('C4').value='PORCENTAJE';staExcelCabecera(dash.getRow(4));
 const estados=[['Total de eventos',total,1,'neutral'],['Finalizados',c('finalizado'),p(c('finalizado')),'green'],['Cancelados',c('cancelado'),p(c('cancelado')),'red'],['Confirmados',c('confirmado'),p(c('confirmado')),'neutral'],['Abiertos',c('abierto'),p(c('abierto')),'neutral']];
 estados.forEach((x,i)=>{const r=dash.getRow(5+i);r.values=[x[0],x[1],x[2]];staExcelFila([r.getCell(1),r.getCell(2),r.getCell(3)],i);r.getCell(3).numFmt='0.0%';if(x[3]==='green'){r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.green)}});r.getCell(1).font={bold:true,color:{argb:staExcelArgb(STA_XLSX.greenText)}}}if(x[3]==='red'){r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.red)}});r.getCell(1).font={bold:true,color:{argb:staExcelArgb(STA_XLSX.redText)}}}});
 dash.getRow(12).values=['EVOLUCIÓN MENSUAL','TOTAL','FINALIZADOS','CANCELADOS','CONFIRMADOS','ABIERTOS','% DEL AÑO'];staExcelCabecera(dash.getRow(12));
 meses.forEach((x,i)=>{const r=dash.getRow(13+i);r.values=x;staExcelFila(r,i);r.getCell(7).numFmt='0.0%'});
 [28,14,16,16,16,12,16].forEach((w,i)=>dash.getColumn(i+1).width=w);dash.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1};
 const detalles=eventos.map(e=>[e.titulo||'',staExcelFecha(e.fecha||''),e.hora?formatearHora(e.hora):'',e.lugar||'',staEstadoNombre(e.estado),e.descripcion||'',(todasFechasEventos||[]).filter(f=>Number(f.evento_id)===Number(e.id)).length]);
 const det=staExcelTablaSimple(wb,'Eventos',`SPIRIT TO ALL · EVENTOS ${anio}`,'Relación completa con filtros',['Evento','Fecha','Hora','Lugar','Estado','Descripción','Nº fechas'],detalles,[34,14,12,28,16,48,12],[],[1]);
 for(let r=5;r<=det.rowCount;r++){const c5=det.getCell(r,5),v=String(c5.value||'').toLowerCase();if(v==='finalizado')c5.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.green)}};if(v==='cancelado')c5.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.red)}}}
 staExcelTablaSimple(wb,'Por estado',`SPIRIT TO ALL · ESTADOS ${anio}`,'Distribución y peso porcentual',['Estado','Eventos','% del total'],['finalizado','cancelado','confirmado','abierto'].map(s=>[staEstadoNombre(s),c(s),p(c(s))]),[24,14,18],[2]);
 staExcelTablaSimple(wb,'Por mes',`SPIRIT TO ALL · EVOLUCIÓN MENSUAL ${anio}`,'Actividad mensual y desglose por estado',['Mes','Total','Finalizados','Cancelados','Confirmados','Abiertos','% del año'],meses,[18,12,15,15,15,12,16],[6]);
 return await staExcelBytes(wb)
}
// =========================================================
// CENTRO DE INFORMES · gestor / administrador
// =========================================================
let staInformeUnaFechaSeleccionada=null;

async function abrirCentroInformes(){
  if(!staTienePermiso('informes'))return;
  if(!todasFechasEventos?.length)await cargarTodasFechasEventos();
  abrirStaSheet('Informes',staCentroInformesHtml('crear'),'history');
}

function abrirInformeAsistenciaDesdeCentro(){
  pushStaSheet('Informe de asistencia', '<div class="sta-sheet-intro"><strong>Cargando…</strong></div>', 'history');
  abrirInformeAsistencia(true);
}

async function abrirInformeUnaEncuesta(){
  staInformeUnaFechaSeleccionada=null;
  if(!todasFechasEventos?.length){
    try{await cargarTodo()}catch(e){console.warn('No se pudieron refrescar las fechas para el informe:',e)}
  }
  pushStaSheet('Control de participantes',staInformeUnaEncuestaHtml(''),'history');
}

function staInformeUnaEncuestaHtml(filtro=''){
  const q=staNormalizarBusqueda(filtro||'').trim();
  let rows='';
  let estadoBusqueda='';

  if(q){
    const arr=(todasFechasEventos||[])
      .map(f=>{const e=eventosActuales.find(x=>Number(x.id)===Number(f.evento_id));return{...f,titulo:e?.titulo||'Evento'}})
      .filter(x=>{
        const blob=staNormalizarBusqueda([x.titulo,x.fecha,x.hora,x.lugar].filter(Boolean).join(' '));
        return q.split(/\s+/).every(t=>blob.includes(t));
      })
      .sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||'')))
      .slice(0,8);

    rows=arr.map(x=>`<button class="sta-report-result sta-report-result-pro ${Number(staInformeUnaFechaSeleccionada)===Number(x.id)?'selected':''}" type="button" onclick="staSeleccionarInformeUnaFecha(${Number(x.id)})"><span class="sta-report-result-copy"><strong>${escapeHtml(x.titulo)}</strong><small>${escapeHtml(formatearFechaCorta(x.fecha||''))}${x.hora?' · '+escapeHtml(formatearHora(x.hora)):''}${x.lugar?' · '+escapeHtml(x.lugar):''}</small></span><span class="sta-report-result-chevron">›</span></button>`).join('');
    estadoBusqueda=rows?'':'<div class="sta-report-empty-search">No hay coincidencias. Prueba con otro nombre, fecha o lugar.</div>';
  }else{
    estadoBusqueda='<div class="sta-report-search-placeholder"><span>🔎</span><strong>Busca la encuesta que necesitas</strong><small>Empieza a escribir arriba. Solo mostraremos coincidencias para mantener la pantalla limpia.</small></div>';
  }

  let seleccionado='';
  if(staInformeUnaFechaSeleccionada){
    const f=(todasFechasEventos||[]).find(x=>Number(x.id)===Number(staInformeUnaFechaSeleccionada));
    const e=f?eventosActuales.find(x=>Number(x.id)===Number(f.evento_id)):null;
    if(f){
      seleccionado=`<div class="sta-report-selected-pro"><span class="sta-report-selected-check">✓</span><span><small>Seleccionada</small><strong>${escapeHtml(e?.titulo||'Evento')}</strong><em>${escapeHtml(formatearFechaCorta(f.fecha||''))}${f.hora?' · '+escapeHtml(formatearHora(f.hora)):''}${f.lugar?' · '+escapeHtml(f.lugar):''}</em></span><button type="button" onclick="staSeleccionarInformeUnaFecha(null)" aria-label="Quitar selección">×</button></div>`;
    }
  }

  return `<div class="sta-sheet-intro"><strong>Control de participantes</strong><p>Busca una encuesta o fecha concreta y genera su Excel de disponibilidad y asistencia.</p></div><div class="sta-report-search sta-report-search-pro"><input id="staInformeUnaBusqueda" type="search" autocomplete="off" placeholder="Buscar por evento, fecha o lugar…" value="${escapeHtml(filtro)}" oninput="staFiltrarInformeUnaEncuesta(this.value)"></div>${seleccionado}<div id="staInformeUnaResultados" class="sta-report-results-pro">${rows}${estadoBusqueda}</div><div id="staInformeUnaEstado" class="sta-report-state-pro">${staInformeUnaFechaSeleccionada?'Lista para preparar el informe.':'Selecciona una coincidencia para continuar.'}</div><div class="sta-report-email-box"><label class="control-label">Correo de destino<input id="staInformeUnaEmail" type="email" inputmode="email" placeholder="nombre@correo.com"></label><small>Escribe el destinatario. Al pulsar «Enviar informe», el XLSX se guardará y se abrirá Gmail/correo con el destinatario, asunto y texto preparados. Adjunta el archivo descargado y revisa antes de enviar.</small></div><div class="sta-save-dock"><button id="staInformeUnaGenerar" class="sta-action-primary" type="button" onclick="generarInformeUnaEncuesta(false,'email')" ${staInformeUnaFechaSeleccionada?'':'disabled'}>${staInformeUnaFechaSeleccionada?'✉️ Enviar informe':'Selecciona una encuesta'}</button><button class="btn-light btn-full" type="button" onclick="generarInformeUnaEncuesta(false,'download')" ${staInformeUnaFechaSeleccionada?'':'disabled'}>⬇️ Descargar Excel</button><button class="btn-light btn-full" type="button" onclick="generarInformeUnaEncuesta(false,'share')" ${staInformeUnaFechaSeleccionada?'':'disabled'}>📤 Abrir / compartir</button></div>`;
}

function staFiltrarInformeUnaEncuesta(valor){
  const body=document.getElementById('staSheetBody'); if(!body)return;
  body.innerHTML=staInformeUnaEncuestaHtml(valor||'');
  const inp=document.getElementById('staInformeUnaBusqueda'); if(inp){inp.focus(); try{inp.setSelectionRange(inp.value.length,inp.value.length)}catch(_){}}
}

function staSeleccionarInformeUnaFecha(id){
  staInformeUnaFechaSeleccionada=Number(id)||null;
  const filtro=document.getElementById('staInformeUnaBusqueda')?.value||'';
  document.getElementById('staSheetBody').innerHTML=staInformeUnaEncuestaHtml(filtro);
}

const STA_XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function staEsMovil(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')}
function staPickerTipoArchivo(nombre,mime){
 const ext=(String(nombre||'').match(/\.([a-z0-9]+)$/i)||[])[1]?.toLowerCase()||'';
 if(ext==='xlsx')return[{description:'Microsoft Excel',accept:{[STA_XLSX_MIME]:['.xlsx']}}];
 if(ext==='zip')return[{description:'Archivo ZIP',accept:{'application/zip':['.zip']}}];
 if(ext==='pdf')return[{description:'Documento PDF',accept:{'application/pdf':['.pdf']}}];
 return mime&&ext?[{description:'Archivo',accept:{[mime]:['.'+ext]}}]:undefined;
}
async function staGuardarBlobCompatible(blob,nombre,{selectorArchivo=true}={}){
 const nav=window.navigator||{};
 if(typeof nav.msSaveOrOpenBlob==='function'){
   nav.msSaveOrOpenBlob(blob,nombre);
   return 'saved-microsoft';
 }
 if(selectorArchivo&&typeof window.showSaveFilePicker==='function'&&!staEsMovil()){
   try{
     const handle=await window.showSaveFilePicker({suggestedName:nombre,types:staPickerTipoArchivo(nombre,blob.type)});
     const writable=await handle.createWritable();await writable.write(blob);await writable.close();
     return 'saved-picker';
   }catch(e){
     if(e?.name==='AbortError')return 'cancelled';
     console.warn('Guardado nativo no disponible; se usa descarga compatible.',e);
   }
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=nombre;a.rel='noopener';a.style.display='none';document.body.appendChild(a);
 try{a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}))}catch(_){a.click()}
 a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);
 return 'downloaded';
}
let staArchivoCompartirPendiente=null;
function staCerrarCompartirArchivoPendiente(){const m=document.getElementById('staFileShareOverlay');if(m)m.remove();staArchivoCompartirPendiente=null}
function staPrepararCompartirBlobCompatible(blob,nombre,titulo='Informe · Spirit to All'){
 staArchivoCompartirPendiente={blob,nombre,titulo};
 document.getElementById('staFileShareOverlay')?.remove();
 const m=document.createElement('div');m.id='staFileShareOverlay';m.style.cssText='position:fixed;inset:0;z-index:50000;background:rgba(0,0,0,.48);display:flex;align-items:flex-end;justify-content:center;padding:14px;box-sizing:border-box';
 m.innerHTML=`<div style="width:min(560px,100%);background:#fff;border-radius:24px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding-bottom:calc(18px + env(safe-area-inset-bottom))"><div style="width:42px;height:5px;border-radius:9px;background:#d9d9dd;margin:0 auto 14px"></div><strong style="display:block;font-size:18px;color:#171717">Excel listo</strong><p style="margin:7px 0 14px;color:#666;font-size:13px;line-height:1.45">Para Microsoft 365, Excel, Outlook o OneDrive, pulsa <b>Abrir / compartir ahora</b>. También puedes guardarlo directamente en Descargas.</p><button type="button" onclick="staCompartirArchivoPendienteAhora()" style="width:100%;min-height:50px;border:0;border-radius:14px;background:#171717;color:#fff;font-weight:900;font-size:15px">📤 Abrir / compartir ahora</button><button type="button" onclick="staDescargarArchivoPendienteAhora()" style="width:100%;min-height:48px;margin-top:8px;border:1px solid #dedfe3;border-radius:14px;background:#fff;color:#171717;font-weight:900;font-size:14px">⬇️ Guardar Excel</button><button type="button" onclick="staCerrarCompartirArchivoPendiente()" style="width:100%;min-height:42px;margin-top:6px;border:0;background:transparent;color:#777;font-weight:800">Cerrar</button></div>`;
 m.addEventListener('click',e=>{if(e.target===m)staCerrarCompartirArchivoPendiente()});document.body.appendChild(m);return 'share-ready';
}
async function staCompartirArchivoPendienteAhora(){
 const p=staArchivoCompartirPendiente;if(!p)return;
 let file=null;try{file=new File([p.blob],p.nombre,{type:p.blob.type||STA_XLSX_MIME,lastModified:Date.now()})}catch(_){}
 let puede=false;try{puede=!!(file&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]}))}catch(_){}
 if(puede){
   try{await navigator.share({files:[file],title:p.titulo,text:'Archivo Excel de Spirit to All'});staCerrarCompartirArchivoPendiente();return}
   catch(e){if(e?.name==='AbortError')return;console.warn('No se pudo compartir el archivo directamente.',e)}
 }
 const r=await staGuardarBlobCompatible(p.blob,p.nombre,{selectorArchivo:true});
 if(r!=='cancelled'){staCerrarCompartirArchivoPendiente();alert('El sistema no permite entregar el archivo directamente a otra app, así que el Excel se ha guardado en el dispositivo.')}
}
async function staDescargarArchivoPendienteAhora(){const p=staArchivoCompartirPendiente;if(!p)return;const r=await staGuardarBlobCompatible(p.blob,p.nombre,{selectorArchivo:true});if(r!=='cancelled')staCerrarCompartirArchivoPendiente()}
async function staEntregarInformeExcel(bytes,nombre,email='',modo='email'){
 const blob=new Blob([bytes],{type:STA_XLSX_MIME});
 if(modo==='share')return staPrepararCompartirBlobCompatible(blob,nombre,'Informe · Spirit to All');
 if(modo==='download')return await staGuardarBlobCompatible(blob,nombre,{selectorArchivo:true});
 if(modo==='email'){
   if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Escribe un correo electrónico válido.');
   const guardado=await staGuardarBlobCompatible(blob,nombre,{selectorArchivo:false});
   if(guardado==='cancelled')return 'cancelled';
   const asunto=nombre.includes('Informe_Anual')?'Informe anual de eventos · Spirit to All':nombre.includes('Informe_Asistencia')?'Informe de asistencia · Spirit to All':'Informe · Spirit to All';
   const tipoInforme=nombre.includes('Informe_Anual')?'informe anual de eventos':nombre.includes('Informe_Asistencia')?'informe de asistencia':'informe de control de participantes';
   const texto=`Buenos días:\n\nLe envío el ${tipoInforme} de Spirit to All.\n\n⚠️ ANTES DE ENVIAR ESTE CORREO:\nLa aplicación acaba de guardar el archivo Excel en este dispositivo. En Microsoft Edge/Outlook y otros navegadores móviles puede tardar un instante en aparecer en Descargas.\n\nArchivo que debes adjuntar:\n${nombre}\n\nCómo hacerlo:\n1. Pulsa el icono del clip (Adjuntar archivo) de este correo.\n2. Entra en Archivos o Descargas.\n3. Selecciona «${nombre}».\n4. Comprueba que el archivo aparece adjunto en el correo.\n5. Cuando esté adjunto, revisa el mensaje y pulsa Enviar.\n\nTambién puedes volver a la app y usar «Abrir / compartir» para enviarlo directamente a Microsoft 365, Excel, Outlook u otra app compatible.\n\nUn saludo,\nSpirit to All`;
   await new Promise(r=>setTimeout(r,1300));
   window.location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
   return 'mail-opened';
 }
 return await staGuardarBlobCompatible(blob,nombre,{selectorArchivo:true});
}
async function generarInformeUnaEncuesta(desdeHistorial=false,modo='download'){
  const id=Number(staInformeUnaFechaSeleccionada);
  const estado=document.getElementById('staInformeUnaEstado');
  if(!id){if(estado){estado.textContent='Selecciona primero una encuesta.';estado.className='err'}return}
  const f=(todasFechasEventos||[]).find(x=>Number(x.id)===id);
  if(!f){if(estado){estado.textContent='No encuentro esa fecha. Actualiza e inténtalo de nuevo.';estado.className='err'}return}
  const e=eventosActuales.find(x=>Number(x.id)===Number(f.evento_id));
  const btn=document.getElementById('staInformeUnaGenerar'); if(btn){btn.disabled=true;btn.textContent='Generando…'}
  if(estado){estado.textContent='Preparando el Excel…';estado.className=''}
  try{
    let resp;
    try{resp=await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:id})}
    catch(netErr){await new Promise(r=>setTimeout(r,700));resp=await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:id})}
    if(resp?.error && /load failed|failed to fetch|network/i.test(String(resp.error.message||''))){
      await new Promise(r=>setTimeout(r,700));
      resp=await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:id});
    }
    const {data,error}=resp||{}; if(error)throw error;
    const filas=Array.isArray(data)?data:[];
    if(!filas.length)throw new Error('El informe no ha devuelto participantes.');
    const bytes=await staCrearXlsx({evento:e?.titulo||'Evento',fecha:f.fecha||'',hora:formatearHora(f.hora)||'',lugar:f.lugar||'',filas});
    const nombre=`Spirit_to_All_${staNombreArchivo(e?.titulo||'Evento')}_${f.fecha||'fecha'}.xlsx`;
    const email=document.getElementById('staInformeUnaEmail')?.value?.trim()||'',entrega=await staEntregarInformeExcel(bytes,nombre,email,modo);
    if(estado){estado.textContent=entrega==='mail-opened'?'✅ Excel guardado. Abriendo Gmail/correo…':entrega==='share-ready'?'✅ Excel preparado para abrir o compartir.':entrega==='cancelled'?'Operación cancelada.':'✅ Excel guardado correctamente.';estado.className=entrega==='cancelled'?'':'ok'}
    if(!desdeHistorial)await staRegistrarInforme('control_participantes',`Control de participantes · ${e?.titulo||'Evento'} · ${formatearFechaCorta(f.fecha||'')}`,{fecha_evento_id:id});
  }catch(err){console.error(err);if(estado){estado.textContent='❌ No se ha podido generar: '+(err?.message||'error desconocido');estado.className='err'}alert('No se ha podido generar el informe. '+(err?.message||'')+'\n\nSi pone “Load failed”, comprueba la conexión y vuelve a pulsar: la app ya hace un segundo intento automático.');}
  finally{if(btn){btn.disabled=false;btn.textContent='✉️ Enviar informe'}}
}

// =========================================================
// INFORMES DE ASISTENCIA · selección de varias encuestas
// =========================================================
let staInformeSeleccion=new Set();
async function abrirInformeAsistencia(desdeCentro=false){
  if(!esGestor())return;if(!todasFechasEventos?.length)await cargarTodasFechasEventos();
  const years=[...new Set((todasFechasEventos||[]).map(f=>String(f.fecha||'').slice(0,4)).filter(Boolean))].sort().reverse(),year=years[0]||String(new Date().getFullYear());
  staInformeSeleccion=new Set((todasFechasEventos||[]).filter(f=>String(f.fecha||'').startsWith(year)).map(f=>String(f.id)));
  if(desdeCentro){document.getElementById('staSheetTitle').textContent='Informe de asistencia';document.getElementById('staSheetBody').innerHTML=staInformeHtml(year);document.getElementById('staSheetBack')?.classList.remove('hidden');}
  else abrirStaSheet('Informe de asistencia',staInformeHtml(year),'history');
}
function staInformeHtml(year){
  const years=[...new Set((todasFechasEventos||[]).map(f=>String(f.fecha||'').slice(0,4)).filter(Boolean))].sort().reverse();
  const rows=(todasFechasEventos||[]).filter(f=>String(f.fecha||'').startsWith(String(year))).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).map(f=>{const e=eventosActuales.find(x=>Number(x.id)===Number(f.evento_id));return `<label class="sta-report-check"><input type="checkbox" value="${f.id}" ${staInformeSeleccion.has(String(f.id))?'checked':''} onchange="staToggleInformeFecha(this)"><span><strong>${escapeHtml(e?.titulo||'Evento')}</strong><small>${escapeHtml(formatearFechaCorta(f.fecha||''))}${f.hora?' · '+escapeHtml(formatearHora(f.hora)):''}${f.lugar?' · '+escapeHtml(f.lugar):''}</small></span></label>`}).join('');
  return `<div class="sta-sheet-intro"><strong>Selecciona las encuestas que quieres analizar</strong><p>Puedes sacar el año completo o marcar solo determinadas actuaciones. El informe calcula asistencia real y porcentajes.</p></div><div class="sta-report-toolbar"><label class="control-label" style="margin:0">Año<select id="staInformeYear" onchange="staCambiarInformeYear(this.value)">${years.map(y=>`<option value="${y}" ${String(y)===String(year)?'selected':''}>${y}</option>`).join('')}</select></label><button class="sta-mini-edit" type="button" onclick="staSeleccionarInformeVisible()">✓ Seleccionar año</button></div><div id="staInformeLista" class="sta-report-list">${rows||'<p class="muted">No hay fechas en este año.</p>'}</div><div class="sta-report-email-box"><label class="control-label">Correo de destino<input id="staInformeMultiEmail" type="email" inputmode="email" placeholder="nombre@correo.com"></label><small>Al pulsar «Enviar informe», el XLSX se guardará y se abrirá Gmail/correo con destinatario, asunto y texto preparados. Adjunta el archivo descargado y revisa antes de enviar.</small></div><div class="sta-save-dock"><button class="sta-action-primary" type="button" onclick="generarInformeAsistencia(false,null,'email')">✉️ Enviar informe</button><button class="btn-light btn-full" type="button" onclick="generarInformeAsistencia(false,null,'download')">⬇️ Descargar Excel</button><button class="btn-light btn-full" type="button" onclick="generarInformeAsistencia(false,null,'share')">📤 Abrir / compartir</button></div>`
}
function staToggleInformeFecha(el){if(el.checked)staInformeSeleccion.add(String(el.value));else staInformeSeleccion.delete(String(el.value))}
function staCambiarInformeYear(year){staInformeSeleccion=new Set((todasFechasEventos||[]).filter(f=>String(f.fecha||'').startsWith(String(year))).map(f=>String(f.id)));document.getElementById('staSheetBody').innerHTML=staInformeHtml(year)}
function staSeleccionarInformeVisible(){document.querySelectorAll('#staInformeLista input[type="checkbox"]').forEach(x=>{x.checked=true;staInformeSeleccion.add(String(x.value))})}
async function generarInformeAsistencia(desdeHistorial=false,anioHistorial=null,modo='download'){
  const ids=[...staInformeSeleccion].map(Number).filter(Boolean);if(!ids.length){alert('Selecciona al menos una encuesta.');return}
  const emailPrevio=document.getElementById('staInformeMultiEmail')?.value?.trim()||'';if(modo==='email'&&(!emailPrevio||!/^\S+@\S+\.\S+$/.test(emailPrevio))){alert('Escribe un correo electrónico válido.');document.getElementById('staInformeMultiEmail')?.focus();return}
  const body=document.getElementById('staSheetBody'),old=body.innerHTML;body.innerHTML='<div class="sta-sheet-intro"><strong>Preparando informe…</strong><p>Revisando disponibilidad y asistencia real de las fechas seleccionadas.</p></div>';
  try{
    const detalle=[];
    for(const id of ids){const f=(todasFechasEventos||[]).find(x=>Number(x.id)===id);if(!f)continue;const e=eventosActuales.find(x=>Number(x.id)===Number(f.evento_id));let resp;try{resp=await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:id})}catch(_){await new Promise(r=>setTimeout(r,700));resp=await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:id})}if(resp?.error&&/load failed|failed to fetch|network/i.test(String(resp.error.message||''))){await new Promise(r=>setTimeout(r,700));resp=await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:id})}const {data,error}=resp||{};if(error)throw error;(data||[]).forEach(p=>detalle.push({...p,fecha_evento_id:id,evento:e?.titulo||'Evento',fecha:f.fecha||'',hora:f.hora||'',lugar:f.lugar||''}))}
    const personas=new Map();for(const r of detalle){const k=String(r.usuario_id),x=personas.get(k)||{nombre:r.nombre||'',cuerda:staCuerdaNombre(r.cuerda_id),instrumento:r.instrumento?etiquetaInstrumento(r.instrumento):'',seleccionadas:0,registradas:0,asistio:0,noAsistio:0,confirmoSi:0};x.seleccionadas++;if(r.asistio===true){x.registradas++;x.asistio++}else if(r.asistio===false){x.registradas++;x.noAsistio++}if(r.respuesta==='si')x.confirmoSi++;personas.set(k,x)}
    const porFecha=ids.map(id=>{const f=(todasFechasEventos||[]).find(x=>Number(x.id)===id),e=eventosActuales.find(x=>Number(x.id)===Number(f?.evento_id)),arr=detalle.filter(r=>Number(r.fecha_evento_id)===id),reg=arr.filter(r=>r.asistio!=null),si=reg.filter(r=>r.asistio===true).length,no=reg.filter(r=>r.asistio===false).length;return{evento:e?.titulo||'Evento',fecha:f?.fecha||'',registrados:reg.length,asistieron:si,noAsistieron:no,porcentaje:reg.length?si/reg.length:0}});
    const bytes=await staCrearXlsxInforme({fechas:porFecha,personas:[...personas.values()],detalle});const year=anioHistorial||document.getElementById('staInformeYear')?.value||'seleccion',email=emailPrevio,entrega=await staEntregarInformeExcel(bytes,`Spirit_to_All_Informe_Asistencia_${year}.xlsx`,email,modo);if(!desdeHistorial)await staRegistrarInforme('asistencia_multiple',`Asistencia · ${year} · ${ids.length} encuesta${ids.length===1?'':'s'}`,{fecha_evento_ids:ids,anio:year});body.innerHTML=old;if(entrega==='mail-opened')console.log('Excel guardado y correo abierto');
  }catch(e){console.error(e);body.innerHTML=old;alert('No se ha podido generar el informe. '+(e?.message||'Revisa la conexión y vuelve a intentarlo.'))}
}
async function staCrearXlsxInforme({fechas=[],personas=[],detalle=[]}={}){
 const wb=await staExcelNuevoLibro();
 staExcelTablaSimple(wb,'Resumen','SPIRIT TO ALL · INFORME DE ASISTENCIA','Resumen por encuesta y porcentaje de asistencia',['Evento','Fecha','Asistencias registradas','Asistieron','No asistieron','% asistencia'],fechas.map(x=>[x.evento,staExcelFecha(x.fecha),x.registrados,x.asistieron,x.noAsistieron,Number(x.porcentaje||0)]),[30,14,20,14,16,16],[5],[1]);
 staExcelTablaSimple(wb,'Personas','SPIRIT TO ALL · INFORME DE ASISTENCIA','Resumen por persona',['Nombre','Cuerda','Instrumento','Fechas seleccionadas','Asistencias registradas','Asistió','No asistió','% asistencia','Confirmó que sí'],personas.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(x=>[x.nombre,x.cuerda,x.instrumento,x.seleccionadas,x.registradas,x.asistio,x.noAsistio,x.registradas?x.asistio/x.registradas:null,x.confirmoSi]),[30,17,20,18,20,12,14,15,16],[7]);
 staExcelTablaSimple(wb,'Detalle','SPIRIT TO ALL · INFORME DE ASISTENCIA','Detalle por evento, persona y relación entre disponibilidad y asistencia',['Evento','Fecha','Nombre','Cuerda','Disponibilidad','Asistencia real','Relación'],detalle.map(x=>[x.evento,staExcelFecha(x.fecha),x.nombre||'',staCuerdaNombre(x.cuerda_id),staRespuestaTexto(x.respuesta),staAsistenciaTexto(x.asistio),staRelacionTexto(x.respuesta,x.asistio)]),[30,14,30,17,18,18,31],[],[1]);
 return await staExcelBytes(wb)
}
function staCol(i){let n=i+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}

// =========================================================
// NAVEGACIÓN UNIVERSAL · herramientas de gestión
// =========================================================
function staActualizarTituloGestionUniversal(){staActualizarHeroGestion()}
function staGestionCerrarUniversal(){staGestionCerrarIntegrado()}
function staGestionAtrasUniversal(){staGestionAtrasIntegrado()}

// =========================================================
// V25 · NAVEGACIÓN PWA CONSOLIDADA
// =========================================================
function staActualizarHeroGestion(){
  const panel=document.getElementById('panelGestor');
  const titulo=document.getElementById('toolScreenTitle');
  const subtitulo=document.getElementById('toolScreenSubtitle');
  if(!titulo||!subtitulo)return;
  if(panel?.classList.contains('modo-dinero')){titulo.textContent='€ Dinero';subtitulo.textContent='Presupuestos y facturación de actuaciones.';return}
  if(!document.getElementById('gestionAdminEnsayos')?.classList.contains('hidden')){titulo.textContent='🎶 Ensayos';subtitulo.textContent='Crear y administrar ensayos de Spirit to All.';return}
  if(panel?.classList.contains('modo-viabilidad')){titulo.textContent='Viabilidad';subtitulo.textContent=gestionVistaEncuestas==='fecha'?eventoActual?.titulo||'':'';return}
  if(gestionVistaEncuestas==='fecha'){titulo.textContent='Viabilidad';subtitulo.textContent=eventoActual?.titulo||'Encuesta';return}
  if(gestionVistaEncuestas==='editar'){titulo.textContent='✏️ Editar encuesta';subtitulo.textContent=eventoActual?.titulo||'Encuesta';return}
  if(gestionVistaEncuestas==='evento'){titulo.textContent='📌 Administrar encuesta';subtitulo.textContent=eventoActual?.titulo||'Encuesta seleccionada';return}
  titulo.textContent='⚙️ Gestión';subtitulo.textContent='Crear y administrar encuestas y ensayos de Spirit to All.';
}
function staPushEstadoPwa(vista){if(history.state?.staPwaVista===vista)return;history.pushState({...history.state,staPwaVista:vista},'',location.href)}
function staReplaceEstadoPwa(vista=null){const st={...(history.state||{})};if(vista)st.staPwaVista=vista;else delete st.staPwaVista;history.replaceState(st,'',location.href)}
function staGestionCerrarIntegrado(){cerrarGestionEncuestas();staReplaceEstadoPwa(null);document.getElementById('menuInicio')?.scrollIntoView({behavior:'auto',block:'start'})}
function staGestionAtrasIntegrado(){
  const panel=document.getElementById('panelGestor');
  if(panel?.classList.contains('modo-dinero')){staGestionCerrarIntegrado();return}
  if(gestionVistaEncuestas==='fecha'){volverDesdeFechaGestion();staActualizarHeroGestion();staReplaceEstadoPwa(panel.classList.contains('modo-viabilidad')?'gestion':'gestion_evento');return}
  if(gestionVistaEncuestas==='editar'){cerrarEdicionEvento();staActualizarHeroGestion();staReplaceEstadoPwa('gestion_evento');return}
  if(gestionVistaEncuestas==='evento'){volverAListaGestionEncuestas();staActualizarHeroGestion();staReplaceEstadoPwa('gestion');return}
  staGestionCerrarIntegrado();
}
function staAtrasFisicoGestion(){
  const panel=document.getElementById('panelGestor');
  if(!panel||panel.classList.contains('hidden'))return false;
  if(panel.classList.contains('modo-dinero')){cerrarGestionEncuestas();return true}
  if(gestionVistaEncuestas==='fecha'){volverDesdeFechaGestion();staActualizarHeroGestion();return true}
  if(gestionVistaEncuestas==='editar'){cerrarEdicionEvento();staActualizarHeroGestion();return true}
  if(gestionVistaEncuestas==='evento'){volverAListaGestionEncuestas();staActualizarHeroGestion();return true}
  cerrarGestionEncuestas();return true;
}

// =========================================================
// V7 · ENSAYOS, EDICIÓN Y GOOGLE CALENDAR
// =========================================================
function cambiarGestionPrincipal(seccion){
  const crear=seccion==='crear';
  document.getElementById('gestionCrearContenido')?.classList.toggle('hidden',!crear);
  document.getElementById('gestionAdministrarContenido')?.classList.toggle('hidden',crear);
  document.getElementById('gestionPrincipalCrear')?.classList.toggle('activa',crear);
  document.getElementById('gestionPrincipalAdministrar')?.classList.toggle('activa',!crear);
  if(!crear){
    cambiarAdministrarGestion('encuestas');
    cargarSelectorGestionEventos();
  }
}
function cambiarCrearGestion(tipo){
  const encuesta=tipo==='encuesta';
  document.getElementById('gestionCrearEncuesta')?.classList.toggle('hidden',!encuesta);
  document.getElementById('gestionCrearEnsayo')?.classList.toggle('hidden',encuesta);
  document.getElementById('gestionCrearEncuestaTab')?.classList.toggle('activa',encuesta);
  document.getElementById('gestionCrearEnsayoTab')?.classList.toggle('activa',!encuesta);
  if(!encuesta)limpiarFormularioEnsayo();
}
function cambiarAdministrarGestion(tipo){
  const encuestas=tipo==='encuestas',ensayos=tipo==='ensayos',presupuestos=tipo==='presupuestos';
  document.getElementById('gestionAdminEncuestas')?.classList.toggle('hidden',!encuestas);
  document.getElementById('gestionAdminEnsayos')?.classList.toggle('hidden',!ensayos);
  document.getElementById('gestionAdminPresupuestos')?.classList.toggle('hidden',!presupuestos);
  document.getElementById('gestionAdminEncuestasTab')?.classList.toggle('activa',encuestas);
  document.getElementById('gestionAdminEnsayosTab')?.classList.toggle('activa',ensayos);
  staActualizarTituloGestionUniversal();
  if(encuestas)cargarSelectorGestionEventos();
  else if(ensayos)cargarEnsayos();
  else if(presupuestos){cambiarDineroVista('presupuestos');cargarSelectorPresupuestos();}
}
function cambiarGestion(seccion){
  /* Compatibilidad con llamadas antiguas */
  if(seccion==='ensayos'){
    cambiarGestionPrincipal('administrar');
    cambiarAdministrarGestion('ensayos');
  }else{
    cambiarGestionPrincipal('administrar');
    cambiarAdministrarGestion('encuestas');
  }
}

const _abrirGestionEncuestasV6=abrirGestionEncuestas;
abrirGestionEncuestas=function(){
  if(!esGestor())return;
  _abrirGestionEncuestasV6();
  cambiarGestionPrincipal('crear');
  cambiarCrearGestion('encuesta');
  staActualizarHeroGestion();
  staPushEstadoPwa('gestion');
};

let gestionVistaEncuestas='lista';
function mostrarVistaGestionEncuestas(vista){
  gestionVistaEncuestas=vista||'lista';
  const root=document.getElementById('gestionAdminEncuestas');
  if(!root)return;
  root.classList.remove('gestion-vista-lista','gestion-vista-evento','gestion-vista-fecha','gestion-vista-editar');
  root.classList.add('gestion-vista-'+gestionVistaEncuestas);
  queueMicrotask(staActualizarTituloGestionUniversal);
  const form=document.getElementById('formEditarEvento');
  if(form&&gestionVistaEncuestas!=='editar')form.classList.add('hidden');
  if(gestionVistaEncuestas==='lista'){
    document.getElementById('detalleFechaGestor')?.classList.add('hidden');
    document.getElementById('resumenGestor')?.classList.add('hidden');
  }
  if(gestionVistaEncuestas==='evento'){
    const herramientas=document.getElementById('gestionDatosEvento');
    const selector=document.getElementById('staFechaHerramientas');
    herramientas.classList.toggle('hidden',!fechasEventoActual.length);
    herramientas.open=false;
    selector.innerHTML=staFechasOpciones();
    selector.value=String(fechaGestorSeleccionada||fechasEventoActual[0]?.id||'');
    document.getElementById('staFechaHerramientasLabel').classList.toggle('hidden',fechasEventoActual.length<2);
    document.getElementById('detalleFechaGestor')?.classList.add('hidden');
    if(eventoActual)document.getElementById('resumenGestor')?.classList.remove('hidden');
  }
  if(gestionVistaEncuestas==='fecha'){
    document.getElementById('resumenGestor')?.classList.remove('hidden');
    document.getElementById('detalleFechaGestor')?.classList.remove('hidden');
  }
}
function volverAListaGestionEncuestas(){
  /* Volver de verdad al listado: elimina cualquier selección/estado profundo previo. */
  cerrarDetallesViabilidad();
  document.getElementById('listaPendientes')?.classList.add('hidden');
  document.getElementById('viabilidadEvento')?.classList.remove('detalle-abierto');
  document.getElementById('detalleFechaGestor')?.classList.remove('viabilidad-expandida');
  eventoActual=null;
  fechasEventoActual=[];
  fechaGestorSeleccionada=null;
  const sel=document.getElementById('gestionEventoSelect');
  if(sel)sel.value='';
  const elegido=document.getElementById('gestorEventoSeleccionado');
  if(elegido)elegido.textContent='Selecciona una encuesta.';
  document.getElementById('accionesEstado')?.classList.add('hidden');
  document.getElementById('resumenGestor')?.classList.add('hidden');
  document.getElementById('detalleFechaGestor')?.classList.add('hidden');
  mostrarVistaGestionEncuestas('lista');
  document.getElementById('panelGestor')?.classList.remove('gestion-app-deep');
  cargarSelectorGestionEventos();
  requestAnimationFrame(()=>document.getElementById('gestionAdminEncuestas')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function volverDesdeFechaGestion(){
  if(document.getElementById('panelGestor').classList.contains('modo-viabilidad')){
    volverAListaGestionEncuestas();
    return;
  }
  document.getElementById('listaPendientes')?.classList.add('hidden');
  cerrarDetallesViabilidad();
  document.getElementById('viabilidadEvento')?.classList.remove('detalle-abierto');
  document.getElementById('detalleFechaGestor')?.classList.remove('viabilidad-expandida');
  mostrarVistaGestionEncuestas('evento');
  requestAnimationFrame(()=>document.getElementById('gestionAdminEncuestas')?.scrollIntoView({behavior:'smooth',block:'start'}));
}

function cargarSelectorGestionEventos(){
  const sel=document.getElementById('gestionEventoSelect');if(!sel)return;
  if(document.getElementById('panelGestor').classList.contains('modo-viabilidad')){
    const encuestas=eventosActuales.filter(e=>!e.eliminado&&['abierto','confirmado'].includes(e.estado))
      .sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||'')));
    sel.innerHTML='<option value="">Elige una encuesta</option>'+encuestas.map(e=>`<option value="${Number(e.id)}">${escapeHtml(e.titulo)}${e.fecha?' · '+escapeHtml(formatearFechaCorta(e.fecha)):''}</option>`).join('');
    sel.value=eventoActual?String(eventoActual.id):'';
    document.getElementById('staAvisoSelectorViabilidad').textContent=encuestas.length?'':'Todavía no hay encuestas disponibles.';
    return;
  }
  const filtro=document.getElementById('gestionEventoFiltro')?.value||'activas',q=(document.getElementById('gestionEventoBuscar')?.value||'').trim().toLowerCase(),ayuda=document.getElementById('gestionEventoAyuda');
  let arr=[...eventosActuales];
  if(filtro==='activas')arr=arr.filter(e=>!e.eliminado&&['abierto','confirmado'].includes(e.estado));
  if(filtro==='recientes')arr=arr.filter(e=>esEventoHistorico(e)).sort((a,b)=>((b.fecha||'')+' '+(b.hora||'')).localeCompare((a.fecha||'')+' '+(a.hora||''))).slice(0,20);
  if(q)arr=arr.filter(e=>String(e.titulo||'').toLowerCase().includes(q));
  if(filtro==='todas'){arr.sort((a,b)=>((b.fecha||'')+' '+(b.hora||'')).localeCompare((a.fecha||'')+' '+(a.hora||'')));if(!q)arr=arr.slice(0,30);else arr=arr.slice(0,50)}
  else if(filtro!=='recientes')arr.sort((a,b)=>((a.fecha||'')+' '+(a.hora||'')).localeCompare((b.fecha||'')+' '+(b.hora||'')));
  sel.innerHTML='<option value="">Selecciona una encuesta</option>'+arr.map(e=>`<option value="${e.id}">${escapeHtml(e.titulo)} · ${formatearFechaCorta(e.fecha)}</option>`).join('');
  if(ayuda)ayuda.textContent=filtro==='activas'?'Mostrando solo abiertas y confirmadas.':filtro==='recientes'?'Mostrando las 20 históricas más recientes.':q?`Mostrando hasta 50 coincidencias para “${q}”.`:'Mostrando las 30 más recientes. Escribe un nombre para buscar antiguas.';
  if(eventoActual&&arr.some(e=>Number(e.id)===Number(eventoActual.id))){sel.value=String(eventoActual.id);document.getElementById('gestorEventoSeleccionado').textContent=eventoActual.titulo+' · '+formatearFechaCorta(eventoActual.fecha);document.getElementById('accionesEstado').classList.remove('hidden');document.getElementById('resumenGestor').classList.remove('hidden')}
}
async function cargarEventoGestionPorId(id){
  const idEvento=Number(id);
  const e=eventosActuales.find(x=>Number(x.id)===idEvento);
  if(!e)return false;
  // Gestión y respuesta de miembro son pantallas distintas.
  document.getElementById('detalleEvento')?.classList.remove('sta-detalle-encuesta-screen');
  document.getElementById('detalleEvento')?.classList.add('hidden');
  ocultarNavGlobalDetalleEvento();
  eventoActual=e;
  fechasEventoActual=obtenerFechasEvento(idEvento);
  fechaGestorSeleccionada=fechasEventoActual[0]?.id||null;
  const elegido=document.getElementById('gestorEventoSeleccionado');
  if(elegido)elegido.textContent=e.titulo+' · '+(fechasEventoActual.length>1?fechasEventoActual.length+' fechas':formatearFechaCorta(e.fecha));
  document.getElementById('gestionPendientesDestacado')?.classList.add('hidden');
  const pendingMsg=document.getElementById('gestionPendientesMensaje');if(pendingMsg)pendingMsg.textContent='';
  document.getElementById('accionesEstado')?.classList.remove('hidden');
  document.getElementById('resumenGestor')?.classList.remove('hidden');
  const sel=document.getElementById('gestionEventoSelect');if(sel)sel.value=String(idEvento);
  prepararMensajeWhatsapp();
  await cargarResumenFechasGestor();
  return true;
}
async function seleccionarEventoGestion(id){
  if(!id){volverAListaGestionEncuestas();return}
  if(document.getElementById('panelGestor').classList.contains('modo-viabilidad')){
    const encuesta=eventosActuales.find(e=>Number(e.id)===Number(id)&&!e.eliminado&&['abierto','confirmado'].includes(e.estado));
    if(!encuesta)return;
    const fechas=obtenerFechasEvento(encuesta.id);
    const aviso=document.getElementById('staAvisoSelectorViabilidad');
    if(!fechas.length){
      aviso.textContent='Esta encuesta todavía no tiene fechas para consultar.';
      return;
    }
    aviso.textContent='';
    document.getElementById('staMensajeRecordatorioViabilidad').textContent='';
    eventoActual=encuesta;
    fechasEventoActual=fechas;
    staPushEstadoPwa('gestion_viabilidad');
    await seleccionarFechaGestor(Number(fechas[0].id),false);
    return;
  }
  const ok=await cargarEventoGestionPorId(id);if(!ok)return;
  document.getElementById('panelGestor')?.classList.remove('hidden');
  document.body.style.overflow='hidden';
  mostrarVistaGestionEncuestas('evento');
  staActualizarHeroGestion();
  staPushEstadoPwa('gestion_evento');
  requestAnimationFrame(()=>document.getElementById('panelGestor')?.scrollTo?.({top:0,behavior:'auto'}));
}

function anadirFechaCreacion(){
  contadorFechaCreacion++;const id=contadorFechaCreacion;const div=document.createElement('div');div.className='fecha-creacion';div.dataset.fechaId=id;
  div.innerHTML=`<div class="fecha-creacion-head"><strong>📅 Fecha ${document.querySelectorAll('#fechasCreacion .fecha-creacion').length+1}</strong>${document.querySelectorAll('#fechasCreacion .fecha-creacion').length?`<button type="button" class="btn-no btn-mini" onclick="quitarFechaCreacion(${id})">✕ Quitar</button>`:''}</div><div class="fecha-grid"><label class="control-label">Fecha<input class="fecha-input" type="date"></label><label class="control-label">Hora inicio<input class="hora-input" type="time"></label><label class="control-label">Hora fin<input class="hora-fin-input" type="time"></label><label class="control-label">Lugar<input class="lugar-input" type="text" placeholder="Lugar"></label></div>`;
  document.getElementById('fechasCreacion').appendChild(div);
}

async function crearEvento(){
  if(!esGestor())return;const titulo=document.getElementById('nuevoTitulo').value.trim(),descripcion=document.getElementById('nuevaDescripcion').value.trim(),fechaLimite=document.getElementById('nuevaFechaLimite').value||null,mensaje=document.getElementById('mensajeCrearEvento');
  const fechas=[...document.querySelectorAll('#fechasCreacion .fecha-creacion')].map(d=>({fecha:d.querySelector('.fecha-input').value,hora:d.querySelector('.hora-input').value,hora_fin:d.querySelector('.hora-fin-input').value,lugar:d.querySelector('.lugar-input').value.trim()}));
  if(!titulo){mensaje.textContent='⚠️ Escribe un título.';return}if(!fechas.length||fechas.some(f=>!f.fecha||!f.hora||!f.hora_fin)){mensaje.textContent='⚠️ Cada sesión necesita fecha, hora de inicio y hora de fin.';return}
  mensaje.textContent='Creando encuesta...';const{data,error}=await supabaseClient.rpc('crear_evento_multiple_v2',{p_titulo:titulo,p_descripcion:descripcion||null,p_fecha_limite:fechaLimite,p_fechas:fechas});
  if(error){console.error(error);mensaje.textContent='❌ No se ha podido crear la encuesta. '+(error.message||'');return}
  document.getElementById('nuevoTitulo').value='';document.getElementById('nuevaDescripcion').value='';document.getElementById('nuevaFechaLimite').value='';document.getElementById('fechasCreacion').innerHTML='';anadirFechaCreacion();
  pestanaActual='abiertas';await cargarTodo();cargarSelectorGestionEventos();if(data){const eventoId=Number(data);await cargarEventoGestionPorId(eventoId);mostrarVistaGestionEncuestas('evento');staActualizarHeroGestion();document.getElementById('panelGestor').classList.remove('hidden');document.body.style.overflow='hidden';const resultado=await enviarNotificacionEvento(eventoId,'todos');mensaje.textContent=resultado.ok?(resultado.enviados>0?'✅ Encuesta creada y aviso enviado a '+resultado.enviados+' dispositivo(s).':'✅ Encuesta creada. '+(resultado.mensaje||'No hay dispositivos registrados.')):'✅ Encuesta creada. El aviso no se pudo enviar.'}
}

function abrirEdicionEvento(){if(!eventoActual)return;document.getElementById('formEditarEvento').classList.remove('hidden');document.getElementById('editarTitulo').value=eventoActual.titulo||'';document.getElementById('editarDescripcion').value=eventoActual.descripcion||'';document.getElementById('editarFechaLimite').value=eventoActual.fecha_limite||'';const cont=document.getElementById('fechasEdicion');cont.innerHTML='';contadorFechaEdicion=0;fechasEventoActual.forEach(f=>anadirFechaEdicion(f));mostrarVistaGestionEncuestas('editar');document.getElementById('gestionAdminEncuestas')?.scrollIntoView({behavior:'smooth',block:'start'})}
function cerrarEdicionEvento(){document.getElementById('formEditarEvento').classList.add('hidden');document.getElementById('mensajeEditarEvento').textContent='';mostrarVistaGestionEncuestas('evento')}
function anadirFechaEdicion(f=null){counter=++contadorFechaEdicion;const cont=document.getElementById('fechasEdicion'),div=document.createElement('div');div.className='edit-fecha';div.dataset.row=counter;div.dataset.dbId=f?.id||'';div.innerHTML=`<div class="edit-fecha-head"><strong>📅 Sesión</strong><button class="btn-no btn-mini" onclick="this.closest('.edit-fecha').remove()">✕ Quitar</button></div><div class="fecha-grid"><label class="control-label">Fecha<input class="edit-fecha-input" type="date" value="${f?.fecha||''}"></label><label class="control-label">Hora inicio<input class="edit-hora-input" type="time" value="${formatearHora(f?.hora)}"></label><label class="control-label">Hora fin<input class="edit-hora-fin-input" type="time" value="${formatearHora(f?.hora_fin)}"></label><label class="control-label">Lugar<input class="edit-lugar-input" type="text" value="${escapeHtml(f?.lugar||'')}"></label></div>`;cont.appendChild(div)}
async function guardarEdicionEvento(){
  if(!esGestor()||!eventoActual)return;const mensaje=document.getElementById('mensajeEditarEvento');const titulo=document.getElementById('editarTitulo').value.trim(),descripcion=document.getElementById('editarDescripcion').value.trim(),fechaLimite=document.getElementById('editarFechaLimite').value||null;
  const filas=[...document.querySelectorAll('#fechasEdicion .edit-fecha')];const fechas=filas.map(d=>({id:d.dataset.dbId?Number(d.dataset.dbId):null,fecha:d.querySelector('.edit-fecha-input').value,hora:d.querySelector('.edit-hora-input').value,hora_fin:d.querySelector('.edit-hora-fin-input').value,lugar:d.querySelector('.edit-lugar-input').value.trim()}));
  if(!titulo){mensaje.textContent='⚠️ El título es obligatorio.';return}if(!fechas.length){mensaje.textContent='⚠️ La encuesta debe conservar al menos una fecha.';return}if(fechas.some(f=>!f.fecha||!f.hora||!f.hora_fin)){mensaje.textContent='⚠️ Cada sesión necesita fecha, hora de inicio y hora de fin.';return}
  mensaje.textContent='Guardando cambios...';const{error}=await supabaseClient.rpc('actualizar_evento_multiple',{p_evento_id:eventoActual.id,p_titulo:titulo,p_descripcion:descripcion||null,p_fecha_limite:fechaLimite,p_fechas:fechas});if(error){console.error(error);mensaje.textContent='❌ No se han podido guardar los cambios. '+(error.message||'');return}
  const id=eventoActual.id;await cargarTodo();await cargarEventoGestionPorId(id);mostrarVistaGestionEncuestas('evento');staActualizarHeroGestion();document.getElementById('panelGestor').classList.remove('hidden');document.body.style.overflow='hidden';cargarSelectorGestionEventos();const aviso=await enviarNotificacionEvento(id,'actualizacion_evento');mensaje.textContent=aviso.ok?(aviso.enviados>0?'✅ Encuesta actualizada y aviso enviado a '+aviso.enviados+' dispositivo(s). Los votos conservados se mantienen.':'✅ Encuesta actualizada. Los votos conservados se mantienen. '+(aviso.mensaje||'')):'✅ Encuesta actualizada. Los votos conservados se mantienen, pero el aviso push no se pudo enviar.';
}

async function cargarRespuestasEnsayosUsuario(){
  respuestasEnsayosUsuario=new Map();
  if(!usuarioActual)return;
  const{data,error}=await supabaseClient.rpc('mis_respuestas_ensayos');
  if(error){console.error('Error cargando respuestas de ensayos:',error);return}
  (data||[]).forEach(r=>respuestasEnsayosUsuario.set(Number(r.ensayo_id),r.respuesta));
}
async function cargarEnsayos(){
  const{data,error}=await supabaseClient.rpc('listar_ensayos');
  if(error){console.error(error);ensayosActuales=[];const l=document.getElementById('listaEnsayos');if(l)l.innerHTML='<p class="muted">No se han podido cargar los ensayos.</p>';return}
  ensayosActuales=data||[];
  // Calendario informativo: no cargar respuestas de asistencia a ensayos.
  renderEnsayos();
  renderEnsayosPendientesUsuario();
  if(!document.getElementById('panelCalendario')?.classList.contains('hidden'))renderCalendario();
}
function estadoRespuestaEnsayo(id){
  const r=respuestasEnsayosUsuario.get(Number(id));
  return r==='si'?'✅ Vas al ensayo':r==='no'?'❌ No puedes asistir':'⏳ Pendiente de confirmar';
}
function renderEnsayosPendientesUsuario(){
  // Los ensayos son calendario informativo; ya no se piden respuestas individuales.
  document.getElementById('ensayosPendientesUsuario')?.classList.add('hidden');
}

function filtrarEnsayosAdmin(valor){renderEnsayos(valor)}
function renderEnsayos(termino=''){
  const l=document.getElementById('listaEnsayos'),resultados=document.getElementById('resultadosEnsayoAdmin');if(!l)return;
  const q=staNormalizarBusqueda(termino||document.getElementById('buscarEnsayoAdmin')?.value||'');
  if(!q){if(resultados)resultados.innerHTML='';l.innerHTML=ensayosActuales.length?'<p class="muted">Escribe arriba para buscar un ensayo.</p>':'<p class="muted">Todavía no hay ensayos publicados.</p>';return}
  const datos=ensayosActuales.filter(e=>staNormalizarBusqueda(`${e.titulo||''} ${e.fecha||''} ${e.lugar||''} ${e.notas||''}`).includes(q));
  if(resultados)resultados.innerHTML='';
  if(!datos.length){l.innerHTML='<p class="muted">No hay ensayos que coincidan con la búsqueda.</p>';return}
  l.innerHTML=datos.map(e=>`<div class="ensayo-item"><div class="ensayo-top"><div><strong>${escapeHtml(e.titulo||'Ensayo Spirit to All')}</strong><div class="muted">${formatearFechaLarga(e.fecha)} · ${formatearHora(e.hora_inicio)}${e.hora_fin?'–'+formatearHora(e.hora_fin):''}${e.lugar?' · 📍 '+escapeHtml(e.lugar):''}</div></div><span class="badge" style="background:#ffedd5;color:#9a3412">Ensayo</span></div>${e.notas?`<div style="margin-top:6px">${escapeHtml(e.notas)}</div>`:''}<div class="ensayo-voto-box"><div class="${respuestasEnsayosUsuario.get(Number(e.ensayo_id))==='si'?'ensayo-respuesta-si':respuestasEnsayosUsuario.get(Number(e.ensayo_id))==='no'?'ensayo-respuesta-no':'ensayo-respuesta-pendiente'}">${estadoRespuestaEnsayo(e.ensayo_id)}</div><div class="ensayo-voto-actions"><button class="btn-yes" onclick="responderEnsayo(${e.ensayo_id},'si')">✓ SÍ, VOY</button><button class="btn-no" onclick="responderEnsayo(${e.ensayo_id},'no')">✕ NO PUEDO</button></div></div><div class="ensayo-actions"><button class="btn-light" onclick="editarEnsayo(${e.ensayo_id})">✏️ Editar</button><button class="btn-light" onclick="anadirEnsayoGoogle(${e.ensayo_id})">📅 Añadir al calendario</button>${e.lugar?`<button class="btn-light" onclick="abrirComoLlegarEnsayo(${e.ensayo_id})">🗺️ Cómo llegar</button>`:''}<button class="btn-light" onclick="mostrarResumenEnsayo(${e.ensayo_id})">📊 Asistencia</button><button class="btn-no" onclick="eliminarEnsayo(${e.ensayo_id})">🗑️ Eliminar</button></div><div id="resumenEnsayo-${e.ensayo_id}" class="resumen-ensayo-box hidden"></div></div>`).join('');
}
async function responderEnsayo(id,respuesta){
  if(!usuarioActual||!['si','no'].includes(respuesta))return;
  const{error}=await supabaseClient.rpc('responder_ensayo',{p_ensayo_id:Number(id),p_respuesta:respuesta});
  if(error){console.error(error);alert('No se ha podido guardar tu asistencia. '+(error.message||''));return}
  respuestasEnsayosUsuario.set(Number(id),respuesta);
  renderEnsayosPendientesUsuario();
  if(esGestor())renderEnsayos();
  if(fechaCalendarioActiva)mostrarDiaCalendario(fechaCalendarioActiva);
}
async function mostrarResumenEnsayo(id){
  if(!esGestor())return;
  const caja=document.getElementById('resumenEnsayo-'+id);
  if(!caja)return;
  caja.classList.remove('hidden');caja.innerHTML='<span class="muted">Calculando asistencia...</span>';
  const [totalRes,cuerdasRes]=await Promise.all([
    supabaseClient.rpc('resumen_ensayo',{p_ensayo_id:Number(id)}),
    supabaseClient.rpc('resumen_ensayo_cuerdas',{p_ensayo_id:Number(id)})
  ]);
  if(totalRes.error||cuerdasRes.error){console.error(totalRes.error||cuerdasRes.error);caja.innerHTML='<span class="muted">No se ha podido cargar el resumen.</span>';return}
  const t=totalRes.data?.[0]||{si:0,no:0,pendientes:0,total:0};
  const nombreCuerda=id=>CUERDAS.find(c=>Number(c.id)===Number(id))?.nombre||'Sin cuerda';
  const cuerdas=(cuerdasRes.data||[]).sort((a,b)=>(Number(a.cuerda_id)||99)-(Number(b.cuerda_id)||99));
  caja.innerHTML=`<strong>📊 Asistencia prevista</strong><div class="resumen-ensayo-total"><div><strong>✅ ${t.si||0}</strong><br><span class="muted">Sí</span></div><div><strong>❌ ${t.no||0}</strong><br><span class="muted">No</span></div><div><strong>⏳ ${t.pendientes||0}</strong><br><span class="muted">Pendientes</span></div></div><div class="muted" style="margin-top:7px">${t.total||0} miembros activos en total.</div><div class="cuerdas-asistencia">${cuerdas.map(c=>`<div class="cuerda-asistencia"><strong>${escapeHtml(nombreCuerda(c.cuerda_id))}</strong><span>✅ ${c.si||0} · ❌ ${c.no||0} · ⏳ ${c.pendientes||0}</span></div>`).join('')}</div><p class="muted" style="margin:9px 0 0">El resumen muestra asistencia; no decide automáticamente si el ensayo es viable.</p>`;
}
function abrirEnsayoCalendario(id){
  const e=ensayosActuales.find(x=>Number(x.ensayo_id)===Number(id));if(!e){abrirCalendario();return}
  const d=new Date((e.fecha||'')+'T12:00:00');if(!Number.isNaN(d.getTime()))mesCalendario=new Date(d.getFullYear(),d.getMonth(),1);
  abrirCalendario();renderCalendario();mostrarDiaCalendario(e.fecha);
  setTimeout(()=>document.getElementById('ensayoAgenda-'+id)?.scrollIntoView({behavior:'smooth',block:'center'}),120);
}
function limpiarFormularioEnsayo(){
  document.getElementById('ensayoId').value='';
  document.getElementById('ensayoTitulo').value='Ensayo Spirit to All';
  ['ensayoFecha','ensayoHoraInicio','ensayoHoraFin','ensayoLugar','ensayoNotas','ensayoRepetirHasta'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  document.getElementById('tituloFormularioEnsayo').textContent='🎶 Añadir ensayo';
  document.getElementById('btnGuardarEnsayo').textContent='➕ Añadir ensayo';
  document.getElementById('btnCancelarEdicionEnsayo').classList.add('hidden');
  document.getElementById('staRepeticionEnsayo').classList.remove('hidden');
  document.getElementById('mensajeEnsayo').textContent='';
}
function abrirEditorEnsayo(fecha=''){
  if(!esGestor())return;
  const panel=document.getElementById('panelCalendario');
  if(panel.classList.contains('hidden'))abrirCalendario();
  limpiarFormularioEnsayo();
  const mesVisible=`${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('ensayoFecha').value=fecha||(fechaCalendarioActiva?.startsWith(mesVisible)?fechaCalendarioActiva:'');
  document.getElementById('staEditorEnsayo').classList.remove('hidden');
  document.getElementById('staEditorEnsayo').scrollIntoView({behavior:'smooth',block:'start'});
}
function cerrarEditorEnsayo(){
  limpiarFormularioEnsayo();
  document.getElementById('staEditorEnsayo')?.classList.add('hidden');
}
function staFechasEnsayoSerie(desde,hasta){
  const inicio=new Date(desde+'T12:00:00');
  const fin=new Date(hasta+'T12:00:00');
  if(!Number.isFinite(inicio.getTime())||!Number.isFinite(fin.getTime())||fin<inicio)throw Error('La fecha final debe ser igual o posterior a la primera.');
  const fechas=[];
  for(let d=new Date(inicio);d<=fin&&fechas.length<=60;d.setDate(d.getDate()+7))fechas.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  if(fechas.length>60)throw Error('Para evitar errores, registra como máximo 60 semanas a la vez.');
  return fechas;
}
async function guardarEnsayo(){
  if(!esGestor())return;
  const id=document.getElementById('ensayoId').value;
  const titulo=document.getElementById('ensayoTitulo').value.trim()||'Ensayo Spirit to All';
  const fecha=document.getElementById('ensayoFecha').value;
  const hi=document.getElementById('ensayoHoraInicio').value;
  const hf=document.getElementById('ensayoHoraFin').value;
  const lugar=document.getElementById('ensayoLugar').value.trim();
  const notas=document.getElementById('ensayoNotas').value.trim();
  const hasta=document.getElementById('ensayoRepetirHasta').value;
  const msg=document.getElementById('mensajeEnsayo');
  const btn=document.getElementById('btnGuardarEnsayo');
  if(!fecha||!hi||!hf||!lugar){msg.textContent='⚠️ Indica fecha, hora de inicio y fin y lugar.';return}
  if(hf<=hi){msg.textContent='⚠️ La hora de fin debe ser posterior a la de inicio.';return}
  let fechas;
  try{fechas=id?[fecha]:staFechasEnsayoSerie(fecha,hasta||fecha)}catch(error){msg.textContent='⚠️ '+error.message;return}
  const duplicados=new Set(ensayosActuales.map(e=>`${e.fecha}|${formatearHora(e.hora_inicio)}|${formatearHora(e.hora_fin)}|${(e.lugar||'').trim().toLowerCase()}`));
  const omitidos=id?0:fechas.filter(f=>duplicados.has(`${f}|${hi}|${hf}|${lugar.toLowerCase()}`)).length;
  if(!id)fechas=fechas.filter(f=>!duplicados.has(`${f}|${hi}|${hf}|${lugar.toLowerCase()}`));
  if(!fechas.length){msg.textContent='ℹ️ Esas fechas ya están registradas; no se ha duplicado ningún ensayo.';return}
  btn.disabled=true;msg.textContent=`Guardando ${fechas.length} ensayo${fechas.length===1?'':'s'}…`;
  let guardados=0,ultimoId=id?Number(id):null,errorFinal=null;
  try{
    for(const f of fechas){
      const args=id?
        {p_ensayo_id:Number(id),p_titulo:titulo,p_fecha:f,p_hora_inicio:hi,p_hora_fin:hf,p_lugar:lugar,p_notas:notas||null}:
        {p_titulo:titulo,p_fecha:f,p_hora_inicio:hi,p_hora_fin:hf,p_lugar:lugar,p_notas:notas||null};
      const{data,error}=await supabaseClient.rpc(id?'editar_ensayo':'crear_ensayo',args);
      if(error){errorFinal=error;break}
      guardados++;ultimoId=id?Number(id):Number(data);
    }
    if(guardados){
      const primera=fechas[0];
      await cargarEnsayos();
      const dia=new Date(primera+'T12:00:00');
      mesCalendario=new Date(dia.getFullYear(),dia.getMonth(),1);
      renderCalendario();mostrarDiaCalendario(primera);
      cerrarEditorEnsayo();
      const resumen=`✅ ${id?'Ensayo actualizado':guardados===1?'Ensayo añadido':guardados+' ensayos añadidos'}${omitidos?' · '+omitidos+' fechas duplicadas omitidas':''}.`;
      document.getElementById('staAvisoEnsayos').textContent=resumen;
      // No lanzar una notificación push por cada fecha de un calendario anual.
      if(guardados===1 && ultimoId && fechas.length===1){
        try{await supabaseClient.functions.invoke('enviar-notificaciones',{body:{tipo:id?'actualizacion_ensayo':'nuevo_ensayo',ensayo_id:ultimoId}})}catch(error){console.warn('Ensayo guardado; no se pudo avisar.',error)}
      }
    }
    if(errorFinal){
      console.error('Error guardando ensayos:',errorFinal);
      const mensaje=`⚠️ Se guardaron ${guardados} de ${fechas.length} fecha(s). ${errorFinal.message||'Revisa la conexión.'}`;
      if(guardados)document.getElementById('staAvisoEnsayos').textContent=mensaje;
      else msg.textContent=mensaje;
    }
  }catch(error){console.error(error);msg.textContent='❌ Error guardando ensayos: '+(error.message||'Inténtalo de nuevo.')}finally{btn.disabled=false}
}
function editarEnsayo(id){
  if(!esGestor())return;
  const e=ensayosActuales.find(x=>Number(x.ensayo_id)===Number(id));
  if(!e){alert('No se ha podido localizar este ensayo.');return}
  abrirEditorEnsayo(e.fecha);
  document.getElementById('ensayoId').value=e.ensayo_id;
  document.getElementById('ensayoTitulo').value=e.titulo||'Ensayo Spirit to All';
  document.getElementById('ensayoFecha').value=e.fecha||'';
  document.getElementById('ensayoHoraInicio').value=formatearHora(e.hora_inicio);
  document.getElementById('ensayoHoraFin').value=formatearHora(e.hora_fin);
  document.getElementById('ensayoLugar').value=e.lugar||'';
  document.getElementById('ensayoNotas').value=e.notas||'';
  document.getElementById('staRepeticionEnsayo').classList.add('hidden');
  document.getElementById('tituloFormularioEnsayo').textContent='✏️ Editar ensayo';
  document.getElementById('btnGuardarEnsayo').textContent='💾 Guardar cambios';
  document.getElementById('btnCancelarEdicionEnsayo').classList.remove('hidden');
}
async function eliminarEnsayo(id){
  if(!esGestor()||!confirm('¿Quitar este ensayo del calendario?'))return;
  const{error}=await supabaseClient.rpc('eliminar_ensayo',{p_ensayo_id:Number(id)});
  if(error){console.error(error);alert('No se ha podido quitar el ensayo.');return}
  const fecha=ensayosActuales.find(e=>Number(e.ensayo_id)===Number(id))?.fecha;
  await cargarEnsayos();
  if(fecha)mostrarDiaCalendario(fecha);
  document.getElementById('staAvisoEnsayos').textContent='✅ Ensayo quitado del calendario.';
}

async function cargarTodasFechasEventos(){const{data,error}=await supabaseClient.from('fechas_evento').select('id,evento_id,fecha,hora,hora_fin,lugar,orden').order('fecha',{ascending:true}).order('hora',{ascending:true});if(error){console.error('Error cargando calendario:',error);todasFechasEventos=[];return}const visibles=new Set(eventosActuales.filter(e=>!e.eliminado).map(e=>Number(e.id)));todasFechasEventos=(data||[]).filter(f=>visibles.has(Number(f.evento_id)))}
const _cargarTodoV6=cargarTodo;
cargarTodo=async function(){
  const [encuestas,ensayos]=await Promise.allSettled([_cargarTodoV6(),cargarEnsayos()]);
  if(ensayos.status==='rejected')console.error('Error al cargar ensayos:',ensayos.reason);
  cargarSelectorGestionEventos();
  return encuestas.status==='fulfilled'&&encuestas.value;
};

function isoGoogle(fecha,hora){return (fecha||'').replaceAll('-','')+'T'+(hora||'00:00').substring(0,5).replace(':','')+'00'}
function abrirComoLlegar(lugar){
  const destino=(lugar||'').trim();
  if(!destino){alert('Esta actividad no tiene una ubicación indicada.');return}
  const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(destino);
  window.open(url,'_blank','noopener,noreferrer');
}
function abrirComoLlegarEnsayo(id){
  const e=ensayosActuales.find(x=>Number(x.ensayo_id)===Number(id));
  if(!e){alert('No se ha podido localizar este ensayo.');return}
  abrirComoLlegar(e.lugar);
}

function staAbrirMapaCodificado(valor){
  try{abrirComoLlegar(decodeURIComponent(String(valor||'')))}catch(_){abrirComoLlegar(String(valor||''))}
}
function staUbicacionEventoSheetHtml(){
  if(!eventoActual)return '<div class="sta-sheet-intro"><strong>Evento no disponible.</strong></div>';
  const fechas=(fechasEventoActual||[]).filter(f=>(f.lugar||'').trim());
  const subtitulo=escapeHtml(eventoActual.titulo||'Evento confirmado');
  const rows=fechas.map(f=>{const lugar=(f.lugar||'').trim(),encoded=encodeURIComponent(lugar);return `<div class="sta-event-sheet-row"><span class="ico">📍</span><span class="copy"><small>${escapeHtml(formatearFechaLarga(f.fecha))}${f.hora?' · '+escapeHtml(formatearHora(f.hora)):''}</small><strong>${escapeHtml(lugar)}</strong></span><button class="btn-light" type="button" onclick="staAbrirMapaCodificado('${encoded}')">MAPS</button></div>`}).join('');
  return `<div class="sta-event-sheet-hero"><span class="ico">📍</span><div><strong>Cómo llegar</strong><small>${subtitulo}</small></div></div><div class="sta-event-sheet-label">Ubicación${fechas.length>1?'es':''}</div><div class="sta-event-sheet-group">${rows||'<div class="sta-event-sheet-row"><span class="ico">📍</span><span class="copy"><small>Ubicación</small><strong>Sin ubicación publicada</strong></span></div>'}</div>`;
}
function abrirComoLlegarEventoActual(){
  const hayLugar=(fechasEventoActual||[]).some(f=>(f.lugar||'').trim());
  if(!hayLugar){alert('Esta actividad no tiene una ubicación indicada.');return}
  abrirStaSheet('Cómo llegar',staUbicacionEventoSheetHtml(),detalleEncuestaAbierto()?'event-detail':null);
}
function abrirComoLlegarFecha(fechaId){
  const f=fechasEventoActual.find(x=>Number(x.id)===Number(fechaId)) || todasFechasEventos.find(x=>Number(x.id)===Number(fechaId));
  if(!f){alert('No se ha podido localizar esta fecha del evento.');return}
  abrirComoLlegar(f.lugar);
}

function escaparICS(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
function fechaHoraICS(fecha,hora){return (fecha||'').replaceAll('-','')+'T'+(hora||'00:00').substring(0,5).replace(':','')+'00'}
function cerrarInstruccionesCalendario(){
  document.getElementById('modalAyudaCalendario')?.classList.add('hidden');
  document.body.classList.remove('sta-calendar-help-open');
}
function mostrarInstruccionesCalendario(nombreArchivo){
  let modal=document.getElementById('modalAyudaCalendario');
  if(!modal){
    modal=document.createElement('div');
    modal.id='modalAyudaCalendario';
    modal.className='hidden';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','tituloAyudaCalendario');
    modal.innerHTML=`<div class="calendar-help-box">
      <div class="calendar-help-head">
        <div style="display:flex;gap:11px;align-items:flex-start"><span class="calendar-help-icon">📅</span><div><h2 id="tituloAyudaCalendario">Archivo de calendario descargado</h2><p class="muted" style="margin:5px 0 0">Solo falta añadirlo a la aplicación de calendario que uses.</p></div></div>
        <button class="calendar-help-close" type="button" onclick="cerrarInstruccionesCalendario()" aria-label="Cerrar">×</button>
      </div>
      <div class="calendar-help-file">📄 <span id="archivoCalendarioNombre"></span></div>
      <ol class="calendar-help-steps">
        <li><div><strong>Abre el archivo descargado.</strong><br><span class="muted">Puedes tocar la notificación de descarga o buscarlo en la carpeta <b>Descargas</b> de tu dispositivo.</span></div></li>
        <li><div><strong>Elige tu aplicación de calendario.</strong><br><span class="muted">Si el dispositivo te pregunta con qué abrirlo, selecciona una aplicación compatible de calendario.</span></div></li>
        <li><div><strong>Confirma el evento.</strong><br><span class="muted">Revisa la fecha, hora y lugar y pulsa <b>Añadir</b>, <b>Guardar</b> o la opción equivalente.</span></div></li>
      </ol>
      <div class="calendar-help-note"><strong>Importante:</strong> descargar el archivo no añade el evento automáticamente. Queda guardado en tu dispositivo hasta que lo abras y confirmes en tu calendario.</div>
      <button class="calendar-help-ok" type="button" onclick="cerrarInstruccionesCalendario()">ENTENDIDO</button>
    </div>`;
    modal.addEventListener('click',ev=>{if(ev.target===modal)cerrarInstruccionesCalendario()});
    document.body.appendChild(modal);
  }
  const nombre=document.getElementById('archivoCalendarioNombre');
  if(nombre)nombre.textContent=nombreArchivo||'archivo .ics';
  modal.classList.remove('hidden');
  document.body.classList.add('sta-calendar-help-open');
  setTimeout(()=>modal.querySelector('.calendar-help-ok')?.focus(),80);
}
function descargarICS({titulo,fecha,horaInicio,horaFin,lugar,descripcion}){
  if(!fecha||!horaInicio||!horaFin){alert('Falta la hora de inicio o de fin para añadir esta actividad al calendario.');return}
  const ahora=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const uid='spirit-to-all-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'@spirittoall';
  const contenido=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Spirit to All//Disponibilidad//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+ahora,'DTSTART:'+fechaHoraICS(fecha,horaInicio),'DTEND:'+fechaHoraICS(fecha,horaFin),'SUMMARY:'+escaparICS(titulo||'Spirit to All'),'DESCRIPTION:'+escaparICS(descripcion||''),'LOCATION:'+escaparICS(lugar||''),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const blob=new Blob([contenido],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  const nombreArchivo='spirit-to-all-'+fecha+'.ics';
  a.href=url;a.download=nombreArchivo;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>mostrarInstruccionesCalendario(nombreArchivo),250);
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}

function mostrarAyudaCalendario(id){
  const ayuda=document.getElementById('ayudaCalendario-'+id);
  if(!ayuda)return;
  ayuda.classList.add('destacada');
  setTimeout(()=>ayuda.classList.remove('destacada'),2400);
}
function abrirGoogleCalendarSesion(fechaId){const f=fechasEventoActual.find(x=>Number(x.id)===Number(fechaId));if(!f||eventoActual?.estado!=='confirmado')return;if(!f.hora_fin){alert('Esta sesión todavía no tiene hora de fin. Un gestor puede añadirla desde Gestión → Editar encuesta.');return}descargarICS({titulo:eventoActual.titulo,fecha:f.fecha,horaInicio:f.hora,horaFin:f.hora_fin,lugar:f.lugar,descripcion:eventoActual.descripcion})}
function anadirEnsayoGoogle(id){const e=ensayosActuales.find(x=>Number(x.ensayo_id)===Number(id));if(!e)return;if(!e.hora_fin){alert('Este ensayo no tiene hora de fin.');return}descargarICS({titulo:e.titulo||'Ensayo Spirit to All',fecha:e.fecha,horaInicio:e.hora_inicio,horaFin:e.hora_fin,lugar:e.lugar,descripcion:e.notas})}

function renderSesionesVotacion(){const zona=document.getElementById('sesionesVotacion'),editable=eventoActual&&['abierto','confirmado'].includes(eventoActual.estado);zona.innerHTML=(eventoActual?.estado==='confirmado'&&fechasEventoActual.length?'<p class="muted">Puedes actualizar tu disponibilidad. Los cambios quedan registrados para la persona responsable de encuestas.</p>':'')+fechasEventoActual.map((f,i)=>{const r=respuestasFechasUsuario.get(Number(f.id)),clase=r==='si'?' respondida-si':r==='no'?' respondida-no':'',respuesta=r==='si'?'✅ Tu respuesta: Sí, voy':r==='no'?'❌ Tu respuesta: No puedo':'⏳ Sin responder';return `<div class="sesion-voto${clase}"><div class="sesion-titulo">${fechasEventoActual.length>1?'Fecha '+(i+1)+' · ':''}${formatearFechaLarga(f.fecha)}</div><div class="muted">🕐 ${formatearHora(f.hora)}${f.hora_fin?'–'+formatearHora(f.hora_fin):''}${f.lugar?' · 📍 '+escapeHtml(f.lugar):''}</div>${editable?`<div class="sesion-votacion"><button class="btn-yes" onclick="responderFecha(${f.id},'si')">✓ SÍ, VOY</button><button class="btn-no" onclick="responderFecha(${f.id},'no')">✕ NO PUEDO</button></div>`:''}<div class="sesion-respuesta">${respuesta}</div>${eventoActual?.estado==='confirmado'?`<button class="google-btn calendario-principal" onclick="abrirGoogleCalendarSesion(${f.id});mostrarAyudaCalendario(${f.id})">📅 AÑADIR AL CALENDARIO</button><div id="ayudaCalendario-${f.id}" class="ayuda-calendario">Se abrirá o descargará un archivo de calendario. Tócalo y elige <strong>Añadir</strong> o <strong>Guardar</strong>.</div>`:''}</div>`}).join('')||'<p class="muted">Esta encuesta no tiene fechas configuradas.</p>';const respondidas=fechasEventoActual.filter(f=>respuestasFechasUsuario.has(Number(f.id))).length;document.getElementById('resumenMiDisponibilidad').textContent=fechasEventoActual.length?`${respondidas} de ${fechasEventoActual.length} fechas respondidas.`:'Sin fechas.'}

let staProximosScroll=0;
let staActuacionesProximas=[];
async function staAbrirProximosEventos(restaurar=false){
  if(!restaurar)staProximosScroll=0;
  abrirStaSheet('Próximos eventos','<p id="staProximosLista" role="status">Cargando actuaciones…</p>');
  const lista=document.getElementById('staProximosLista');
  try{
    const {data,error}=await supabaseClient.rpc('sta_proximas_actuaciones');
    if(!lista?.isConnected)return;
    if(error)throw error;
    staActuacionesProximas=data||[];
    lista.outerHTML='<section aria-label="Actuaciones confirmadas"><p class="sta-sheet-intro">Confirmados hasta finales del mes que viene</p>'+(
      staActuacionesProximas.length?staActuacionesProximas.map((evento,i)=>
        staControlFila('📅',evento.titulo,[formatearFechaCorta(evento.fecha),staFmtHora(evento.hora)||'Hora por confirmar',evento.lugar].filter(Boolean).join(' · '),
          'staVerActuacionProxima('+i+')')).join(''):'<p>No hay actuaciones confirmadas en este periodo.</p>')+'</section>';
    document.getElementById('staSheetBody').scrollTop=staProximosScroll;
  }catch(error){
    console.error(error);
    if(lista?.isConnected)lista.outerHTML='<p role="alert">No se han podido cargar las actuaciones.</p><button class="btn-light" type="button" onclick="staAbrirProximosEventos(true)">Reintentar</button>';
  }
}
function staVerActuacionProxima(i){
  const evento=staActuacionesProximas[i];
  if(!evento)return;
  staProximosScroll=document.getElementById('staSheetBody').scrollTop;
  void staAbrirFichaBolo(evento.origen,Number(evento.referencia),evento);
}

const staCamposFicha={
  convocatoria:[['fecha_montaje','Fecha de montaje (si es otro día)','date'],['convocatoria_montaje','Llegada de montaje y sonido','time'],['convocatoria_musicos','Llegada de músicos','time'],['convocatoria_coro','Llegada del coro','time']],
  repertorio:[['repertorio','Canciones','textarea'],['solistas','Solistas','textarea'],['youtube','Enlace de YouTube','url']],
  vestuario:[['vestuario_estado','Estado','estado'],['vestuario','Indicaciones de vestuario','textarea'],['vestuario_url','Enlace al documento (Drive, PDF, Word o Excel)','url']],
  logistica:[['punto_encuentro','Punto de encuentro','text'],['mapa','Enlace para llegar','url'],['montaje','Quién monta','textarea'],['hora_montaje','Hora de montaje','time'],['punto_tecnico','Punto de montaje','text']]
};
const staTitulacionesFicha={convocatoria:'Convocatoria',repertorio:'Repertorio y solistas',vestuario:'Vestuario',logistica:'Cómo llegar y montaje'};

async function staAbrirFichaBolo(origen,referencia,sesion=null){
  const html='<div id="staFichaBoloContenido" role="status">Cargando ficha del bolo…</div>';
  if(document.getElementById('staSheetBackdrop').classList.contains('hidden'))abrirStaSheet('Ficha del bolo',html);
  else pushStaSheet('Ficha del bolo',html);
  const panel=document.getElementById('staFichaBoloContenido');
  await staCargarPanelFichaBolo(panel,origen,referencia,sesion);
}

async function staCargarPanelFichaBolo(panel,origen,referencia,sesion){
  try{
    const {data,error}=await supabaseClient.rpc('sta_ficha_bolo',{p_origen:origen,p_referencia:referencia});
    if(error||!data)throw error||new Error('Ficha no disponible');
    const doc=await supabaseClient.rpc('sta_vestuario_documento',{p_origen:data.origen,p_referencia:data.referencia});
    if(doc.error)console.warn('Documento de vestuario no disponible',doc.error);
    data.documento_vestuario=doc.data?.documento||null;
    if(!panel.isConnected)return;
    panel.removeAttribute('role');
    staPintarFichaBolo(panel,data,sesion);
  }catch(error){
    if(!panel.isConnected)return;
    panel.textContent='No se ha podido cargar la ficha del bolo.';
    const reintentar=document.createElement('button');
    reintentar.type='button';reintentar.className='btn-light';reintentar.textContent='Reintentar';
    reintentar.onclick=()=>{panel.textContent='Cargando ficha del bolo…';void staCargarPanelFichaBolo(panel,origen,referencia,sesion)};
    panel.append(' ',reintentar);
  }
}

function staPintarFichaBolo(panel,f,sesion=null){
  panel.staRestaurar=panelNuevo=>{
    staPintarFichaBolo(panelNuevo,f,sesion);
    void staCargarPanelFichaBolo(panelNuevo,f.origen,f.referencia,sesion);
  };
  const ev=Number(f.evento_id)||0,bolo=Number(f.bolo_id)||0;
  const encuestaVisible=ev&&eventosActuales.some(e=>Number(e.id)===ev&&!e.eliminado);
  const fecha=sesion?.fecha||f.fecha,hora=sesion?.hora||f.hora,lugar=sesion?.lugar||f.lugar;
  const texto=(v,defecto='Por publicar')=>escapeHtml(v||defecto);
  const horaTexto=v=>v?staFmtHora(v):'';
  const url=v=>typeof v==='string'&&/^https:\/\/[^\s]+$/.test(v)?v:'';
  const mapa=url(f.mapa)||(lugar?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lugar):'');
  const enlace=(v,t)=>v?`<a class="sta-actuacion-link" href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${t}</a>`:'';
  const boton=(key,nombre)=>`<button class="btn-light" type="button" data-ficha-accion="${key}">${nombre}</button>`;
  const bloque=(titulo,cuerpo)=>`<section class="sta-actuacion-card"><h3>${titulo}</h3>${cuerpo}</section>`;
  const linea=(etiqueta,valor)=>valor?`<p><strong>${etiqueta}</strong> · ${texto(valor)}</p>`:'';
  const puedeEditar=f.edita_convocatoria||f.edita_repertorio||f.edita_vestuario||f.edita_logistica;
  const horario=(clase,titulo,dia,tiempo)=>`<div class="sta-ficha-horario ${clase}">
    <span class="sta-ficha-horario-label">${titulo}</span>
    ${dia?`<time class="sta-ficha-horario-dia" datetime="${escapeHtml(dia)}">${texto(formatearFechaLarga(dia))}</time>`:'<span class="sta-ficha-horario-dia sta-ficha-horario-dia-pendiente">Fecha por confirmar</span>'}
    ${tiempo?`<time class="sta-ficha-horario-hora" datetime="${escapeHtml(horaTexto(tiempo))}">${texto(horaTexto(tiempo))}</time>`:'<span class="sta-ficha-horario-hora sta-ficha-sin-hora">Hora por confirmar</span>'}
  </div>`;
  const convocatoriaDia=fecha||f.fecha_convocatoria;
  const fechaMontaje=f.fecha_montaje||convocatoriaDia;
  const horaConvocatoria=v=>v?texto(horaTexto(v)):'Por confirmar';
  const botonesGestion=[
    encuestaVisible?boton('encuesta','Ver encuesta'):'',
    !ev&&bolo&&f.gestiona_encuesta?boton('crear_encuesta','Crear encuesta'):'',
    bolo&&f.gestiona_produccion&&esGestor()?boton('produccion','Producción'):'',
    bolo&&staGestionaArea('marketing')?boton('marketing','Marketing'):'',
    bolo&&staGestionaArea('logistica')?boton('logistica','Logística'):'',
    bolo&&f.gestiona_comercial?boton('comercial','Gestión comercial'):'',
    bolo&&f.gestiona_comercial?boton('editar_bolo','Editar datos del bolo'):'',
    esGestor()&&ev?boton('whatsapp','Preparar WhatsApp'):''
  ].join('');
  const botonesEconomia=[
    bolo&&f.gestiona_comercial?boton('presupuesto','Presupuesto del bolo'):'',
    f.gestiona_finanzas?boton('facturas',ev?'Facturas de la actuación':'Facturación general'):'',
    f.gestiona_finanzas?boton('contabilidad',ev?'Expediente contable':'Contabilidad general'):''
  ].join('');
  panel.innerHTML=`<article class="sta-actuacion sta-ficha-unificada">
    <header class="sta-actuacion-hero">
      <h2>${texto(f.titulo,'Bolo')}</h2>
      <p>${texto(lugar,'Lugar por confirmar')}</p>
    </header>
    <div class="sta-ficha-horarios" aria-label="Fecha y hora de la actuación">
      ${horario('sta-ficha-horario-bolo','Concierto',fecha,hora)}
    </div>
    <section class="sta-ficha-convocatorias" aria-label="Convocatorias del equipo">
      <h3>Hora de llegada de cada grupo</h3>
      <p>${convocatoriaDia?`Fecha habitual: <strong>${texto(formatearFechaLarga(convocatoriaDia))}</strong>`:'Fecha del bolo por confirmar'}</p>
      <div class="sta-ficha-convocatorias-lista">
        <div><strong>Montaje y sonido</strong><span>${horaConvocatoria(f.convocatoria_montaje)}</span>${fechaMontaje&&fechaMontaje!==convocatoriaDia?`<small>${texto(formatearFechaLarga(fechaMontaje))}</small>`:''}</div>
        <div><strong>Músicos</strong><span>${horaConvocatoria(f.convocatoria_musicos)}</span></div>
        <div><strong>Coro</strong><span>${horaConvocatoria(f.convocatoria_coro)}</span>${f.fecha_convocatoria&&f.fecha_convocatoria!==fecha?`<small>${texto(formatearFechaLarga(f.fecha_convocatoria))}</small>`:''}</div>
      </div>
      ${f.edita_convocatoria&&f.convocatoria?`<p class="sta-ficha-convocatoria-anterior">Dato anterior sin grupo asignado: <strong>${texto(horaTexto(f.convocatoria))}</strong>. Comprueba a quién corresponde y pon la hora en su casilla.</p>`:''}
    </section>
    ${puedeEditar?`<button class="btn-primary sta-ficha-editar" type="button" data-ficha-accion="editar" aria-expanded="false">Editar información para el coro</button><div data-ficha-editor hidden></div>`:''}
    <div class="sta-actuacion-grid">
      ${bloque('Cómo llegar',linea('Punto de encuentro',f.punto_encuentro)+linea('Lugar',lugar)+enlace(mapa,'Abrir mapa'))}
      ${bloque('Vestuario',`<p>${texto(f.vestuario_estado==='no_aplica'?'Sin vestuario específico':f.vestuario)}</p>`+enlace(url(f.vestuario_url),'📄 Abrir enlace de vestuario')+(f.documento_vestuario?`<button type="button" class="sta-actuacion-link" data-ficha-accion="documento">📎 ${texto(f.documento_vestuario.nombre)}</button>`:''))}
      ${bloque('Repertorio y solistas',`<p>${texto(f.repertorio)}</p>`+linea('Solistas',f.solistas)+enlace(url(f.youtube),'Ver en YouTube'))}
      ${bloque('Sonido y montaje',linea('Técnico',f.tecnico_sonido)+linea('Quién monta',f.montaje||'Por asignar')+linea('Hora de montaje',horaTexto(f.hora_montaje))+linea('Punto de montaje',f.punto_tecnico)+linea('Quién desmonta',f.desmontaje)+linea('Hora de desmontaje',horaTexto(f.hora_desmontaje)))}
      ${f.alojamiento?bloque('Alojamiento',`<p>${texto(f.alojamiento)}</p>`):''}
    </div>
    ${botonesGestion?`<section class="sta-ficha-accesos"><h3>Gestión del bolo</h3><div>${botonesGestion}</div></section>`:''}
    ${botonesEconomia?`<section class="sta-ficha-accesos"><h3>Economía</h3><div>${botonesEconomia}</div></section>`:''}
    <p data-ficha-aviso class="muted" role="status"></p>
  </article>`;
  panel.onclick=async event=>{
    const btn=event.target.closest('button[data-ficha-accion]');
    if(!btn||btn.disabled)return;
    const accion=btn.dataset.fichaAccion;
    if(accion==='editar'){
      const editor=panel.querySelector('[data-ficha-editor]');
      editor.hidden=!editor.hidden;
      btn.setAttribute('aria-expanded',String(!editor.hidden));
      if(!editor.hidden&&!editor.childElementCount)staEditarFichaBolo(editor,panel,f,sesion);
      return;
    }
    const aviso=panel.querySelector('[data-ficha-aviso]');
    const salirDeFicha=()=>{
      cerrarStaSheet();
      if(detalleEncuestaAbierto())cerrarDetalleEncuesta();
    };
    btn.disabled=true;
    try{
      if(accion==='documento'){
        const {data,error}=await supabaseClient.storage.from('sta-vestuario-documentos').createSignedUrl(f.documento_vestuario.path,300);
        if(error||!data?.signedUrl)throw error||new Error('No se pudo abrir el documento');
        window.location.href=data.signedUrl;return;
      }
      if(accion==='encuesta'){cerrarStaSheet();await seleccionarEvento(ev,'encuestas');return}
      if(accion==='whatsapp'){
        const e=eventosActuales.find(x=>Number(x.id)===ev);
        if(e){salirDeFicha();eventoActual=e;abrirPanelWhatsapp()}
        return;
      }
      if(accion==='facturas'){
        salirDeFicha();abrirPresupuestosDirecto();
        staFacturaContextoBolo=ev?{id:ev,titulo:f.titulo}:null;
        document.getElementById('buscarFactura').value='';
        document.getElementById('facturaForm').classList.add('hidden');
        cambiarDineroVista('facturas');
        return;
      }
      if(accion==='contabilidad'){salirDeFicha();abrirContabilidadDirecto(ev||null);return}
      if(!staCrmOportunidad(bolo))await staCrmCargar();
      if(!panel.isConnected)return;
      if(!staCrmOportunidad(bolo))throw new Error('Acceso de gestión no disponible para este bolo.');
      if(accion==='produccion')await staProdOppAbrir(bolo);
      if(accion==='marketing'||accion==='logistica'){
        if(!staGestionaArea(accion))throw new Error('No tienes acceso a esta área.');
        staProdOppArea=accion;
        await staProdOppAbrir(bolo);
      }
      if(accion==='comercial')await staCrmAbrirOportunidad(bolo);
      if(accion==='editar_bolo')staCrmEditarOportunidad(bolo,null);
      if(accion==='crear_encuesta')staCrmPrepararEncuesta(bolo);
      if(accion==='presupuesto')await staCrmPresupuesto(bolo);
    }catch(error){if(aviso.isConnected)aviso.textContent=error.message||'No se pudo abrir este apartado.'}
    finally{btn.disabled=false}
  };
}

function staEditarFichaBolo(editor,panel,f,sesion){
  const activo={convocatoria:f.edita_convocatoria,repertorio:f.edita_repertorio,vestuario:f.edita_vestuario,logistica:f.edita_logistica};
  const campo=([key,label,tipo])=>{
    const valor=escapeHtml(tipo==='time'?staFmtHora(f[key]||''):f[key]||'');
    const id='staFichaCampo-'+key;
    const control=tipo==='textarea'?`<textarea id="${id}" name="${key}" rows="3">${valor}</textarea>`:
      tipo==='estado'?`<select id="${id}" name="estado">${[['pendiente','Pendiente'],['definido','Definido'],['no_aplica','Sin vestuario específico']].map(([k,t])=>`<option value="${k}" ${f.vestuario_estado===k?'selected':''}>${t}</option>`).join('')}</select>`:
      `<input id="${id}" name="${key}" type="${tipo}" value="${valor}">`;
    return `<label class="control-label" for="${id}">${label}${control}</label>`;
  };
  editor.innerHTML=Object.entries(staCamposFicha).filter(([key])=>activo[key]).map(([key,campos])=>
    `<details class="sta-ficha-bloque"><summary>${staTitulacionesFicha[key]}</summary><form data-seccion="${key}">
      <div class="${key==='convocatoria'?'sta-ficha-campos-convocatoria':''}">${campos.map(campo).join('')}</div><button type="submit" class="btn-primary">Guardar ${key==='logistica'?'logística':key}</button>${key==='vestuario'?`<div class="sta-ficha-archivo"><label class="control-label">Archivo de vestuario (PDF, Word o Excel · máximo 5 MB)<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" data-vestuario-file></label><button type="button" class="btn-light" data-vestuario-subir>Subir archivo</button>${f.documento_vestuario?`<button type="button" class="btn-light" data-vestuario-quitar>Quitar archivo actual</button>`:''}<p data-vestuario-estado role="status" class="muted"></p></div>`:''}<p role="status" class="muted"></p>
    </form></details>`).join('');
  const primero=editor.querySelector('details');
  if(primero)primero.open=true;
  editor.onclick=event=>{
    const subir=event.target.closest('[data-vestuario-subir]'),quitar=event.target.closest('[data-vestuario-quitar]');
    if(subir||quitar)void staCambiarDocumentoVestuario(editor,panel,f,sesion,!!subir);
  };
  editor.onsubmit=async event=>{
    event.preventDefault();
    const form=event.target,btn=form.querySelector('button'),msg=form.querySelector('[role=status]');
    if(btn.disabled)return;
    const seccion=form.dataset.seccion;
    const datos=Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value).trim()]));
    if(seccion==='convocatoria'&&datos.fecha_montaje&&!datos.convocatoria_montaje){
      msg.textContent='Indica también la hora del montaje cuando cambies su fecha.';
      return;
    }
    if(seccion==='repertorio'&&datos.youtube){
      const valida=normalizarUrlYoutube(datos.youtube);
      if(!valida){msg.textContent='Introduce un enlace válido de YouTube.';return}
      datos.youtube=valida;
    }
    if(seccion==='vestuario'&&datos.vestuario_url&&!/^https:\/\/[^\s]+$/i.test(datos.vestuario_url)){
      msg.textContent='El enlace al documento debe empezar por https://';return;
    }
    btn.disabled=true;msg.textContent='Guardando…';
    try{
      const {data,error}=await supabaseClient.rpc('sta_ficha_bolo',{p_origen:f.origen,p_referencia:f.referencia,p_seccion:seccion,p_datos:datos});
      if(error||!data)throw error||new Error('Guardado no confirmado');
      if(!panel.isConnected)return;
      const e=eventosActuales.find(x=>Number(x.id)===Number(data.evento_id));
      if(e&&seccion==='repertorio')Object.assign(e,{repertorio:data.repertorio,solistas:data.solistas,repertorio_youtube:data.youtube});
      Object.assign(f,data);
      staPintarFichaBolo(panel,f,sesion);
      panel.querySelector('[data-ficha-editor]').replaceWith(editor);
      panel.querySelector('[data-ficha-accion="editar"]').setAttribute('aria-expanded','true');
      msg.textContent='Guardado. Visible para el coro cuando la actuación está confirmada.';
    }catch(error){msg.textContent=error.message||'No se pudieron guardar los datos.'}
    finally{btn.disabled=false}
  };
}

async function staCambiarDocumentoVestuario(editor,panel,f,sesion,subir){
  const form=editor.querySelector('form[data-seccion="vestuario"]');
  const input=form?.querySelector('[data-vestuario-file]'),estado=form?.querySelector('[data-vestuario-estado]');
  const archivo=input?.files?.[0],botones=form?.querySelectorAll('[data-vestuario-subir],[data-vestuario-quitar]');
  if(!estado)return;
  const tipos={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  const ext=archivo?.name.split('.').pop().toLowerCase();
  if(subir&&(!archivo||!tipos[ext]||archivo.size<1||archivo.size>5242880)){estado.textContent='Elige un PDF, Word o Excel de hasta 5 MB.';return}
  if(!subir&&!f.documento_vestuario)return;
  botones.forEach(b=>b.disabled=true);estado.textContent=subir?'Subiendo archivo…':'Quitando archivo…';
  let nuevo=null;
  const bucket=supabaseClient.storage.from('sta-vestuario-documentos');
  try{
    if(subir){
      nuevo=`${usuarioActual.id}/${f.origen}-${f.referencia}/${crypto.randomUUID()}.${ext}`;
      const r=await bucket.upload(nuevo,archivo,{contentType:tipos[ext],upsert:false});if(r.error)throw r.error;
    }
    const {data,error}=await supabaseClient.rpc('sta_vestuario_documento',{
      p_origen:f.origen,p_referencia:f.referencia,p_guardar:true,p_path:nuevo,
      p_nombre:subir?archivo.name:null,p_tipo:subir?tipos[ext]:null,p_tamano:subir?archivo.size:null
    });
    if(error)throw error;
    if(data?.anterior_path&&data.anterior_path!==nuevo){
      const borrado=await bucket.remove([data.anterior_path]);if(borrado.error)console.warn('Archivo anterior pendiente de limpieza',borrado.error);
    }
    f.documento_vestuario=data?.documento||null;
    if(panel.isConnected)staPintarFichaBolo(panel,f,sesion);
  }catch(error){
    if(nuevo)await bucket.remove([nuevo]);
    estado.textContent=error?.message||'No se pudo guardar el archivo.';
    botones.forEach(b=>b.disabled=false);
  }
}

let staBolosCalendario=[];
let staPeticionBolosCalendario=0;
async function staCargarBolosCalendario(){
  const peticion=++staPeticionBolosCalendario;
  const usuarioId=usuarioActual?.id;
  const estado=document.getElementById('staEstadoBolosCalendario');
  staBolosCalendario=[];
  estado.hidden=false;
  estado.textContent='Cargando bolos confirmados…';
  renderCalendario();
  const {data,error}=await supabaseClient.rpc('sta_bolos_confirmados_calendario');
  if(peticion!==staPeticionBolosCalendario||usuarioActual?.id!==usuarioId)return;
  if(error){
    console.error('Error cargando bolos confirmados:',error);
    estado.innerHTML='No se han podido cargar los bolos confirmados. <button type="button" class="btn-light btn-mini" onclick="staCargarBolosCalendario()">Reintentar</button>';
    return;
  }
  staBolosCalendario=data||[];
  estado.hidden=true;
  renderCalendario();
}

function fechasConfirmadasCalendario(fecha){
  const confirmados=new Map(eventosActuales.filter(e=>e.estado==='confirmado'&&!e.eliminado).map(e=>[Number(e.id),e]));
  const filas=todasFechasEventos.filter(f=>f.fecha===fecha&&confirmados.has(Number(f.evento_id)));
  const hora=h=>String(h||'').slice(0,5);
  const reemplazadas=new Set();
  const bolos=staBolosCalendario.filter(b=>b.fecha===fecha).map(b=>{
    const sesiones=filas.filter(f=>Number(f.evento_id)===Number(b.evento_id));
    const candidata=sesiones.find(f=>hora(f.hora)===hora(b.hora)&&hora(b.hora))||
      (sesiones.length===1&&(!hora(b.hora)||!hora(sesiones[0].hora))?sesiones[0]:null);
    if(candidata)reemplazadas.add(candidata);
    return {...b,hora:b.hora||candidata?.hora,lugar:b.lugar||candidata?.lugar,tipo:'bolo'};
  });
  const encuestas=filas.filter(f=>!reemplazadas.has(f)).map(f=>({...f,titulo:confirmados.get(Number(f.evento_id)).titulo,tipo:'encuesta'}));
  return [...bolos,...encuestas].sort((a,b)=>(a.hora||'99:99').localeCompare(b.hora||'99:99')||a.titulo.localeCompare(b.titulo,'es'));

}

function renderCalendario(){const titulo=document.getElementById('tituloMesCalendario'),grid=document.getElementById('calendarioGrid');if(!titulo||!grid)return;titulo.textContent=mesCalendario.toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(/^./,letra=>letra.toLocaleUpperCase('es-ES'));const y=mesCalendario.getFullYear(),m=mesCalendario.getMonth(),first=new Date(y,m,1),start=(first.getDay()+6)%7,inicio=new Date(y,m,1-start),hoy=new Date();let html='';for(let i=0, totalDias=Math.ceil((start+new Date(y,m+1,0).getDate())/7)*7;i<totalDias;i++){const d=new Date(inicio);d.setDate(inicio.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,fechas=fechasConfirmadasCalendario(iso),ens=ensayosActuales.filter(e=>e.fecha===iso),fuera=d.getMonth()!==m?' out':'',esHoy=d.toDateString()===hoy.toDateString()?' today':'',esSeleccionado=fechaCalendarioActiva===iso?' selected':'';const etiquetas=`<span class="cal-activities">${ens.length?'<span class="cal-activity rehearsal">Ensayo</span>':''}${fechas.length?'<span class="cal-activity concert">Concierto</span>':''}</span>`;const total=fechas.length+ens.length;html+=`<button class="cal-day${fuera}${esHoy}${esSeleccionado}" data-fecha="${iso}" aria-label="${escapeHtml(formatearFechaLarga(iso))}, ${ens.length} ensayos y ${fechas.length} conciertos" onclick="mostrarDiaCalendario('${iso}')"><span class="cal-num">${d.getDate()}</span>${etiquetas}</button>`}grid.innerHTML=html;const activa=fechaCalendarioActiva;if(activa&&activa.startsWith(`${y}-${String(m+1).padStart(2,'0')}`))mostrarDiaCalendario(activa);else document.getElementById('agendaDia').innerHTML='<p class="muted">Pulsa un día con actividades para verlas.</p>';staMostrarProximosEnsayos()}
function staMostrarProximosEnsayos(){
  const cont=document.getElementById('staProximosEnsayos');if(!cont)return;
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const proximos=ensayosActuales.filter(e=>new Date((e.fecha||'1970-01-01')+'T12:00:00')>=hoy).sort((a,b)=>String(a.fecha+' '+a.hora_inicio).localeCompare(String(b.fecha+' '+b.hora_inicio))).slice(0,8);
  cont.innerHTML='<h3>🎶 Próximos ensayos</h3>'+(proximos.length?proximos.map(e=>`<button class="sta-ensayo-proximo" type="button" onclick="abrirEnsayoCalendario(${Number(e.ensayo_id)})"><span><strong>${formatearFechaLarga(e.fecha)}</strong><small>${escapeHtml(e.titulo||'Ensayo Spirit to All')}</small></span><span class="sta-ensayo-proximo-hora">${formatearHora(e.hora_inicio)}${e.lugar?' · '+escapeHtml(e.lugar):''} ›</span></button>`).join(''):'<p class="muted">No hay próximos ensayos publicados.</p>');
}
function mostrarDiaCalendario(fecha){
  fechaCalendarioActiva=fecha;
  document.querySelectorAll('#calendarioGrid .cal-day').forEach(btn=>btn.classList.remove('selected'));
  document.querySelector(`#calendarioGrid .cal-day[data-fecha="${fecha}"]`)?.classList.add('selected');
  const fs=fechasConfirmadasCalendario(fecha),ens=ensayosActuales.filter(e=>e.fecha===fecha),agenda=document.getElementById('agendaDia');
  let items='';
  items+=ens.map(e=>{
    const gestor=esGestor();
    return `<div id="ensayoAgenda-${e.ensayo_id}" class="agenda-event agenda-rehearsal sta-ensayo-agenda-simple"><strong>🎶 ${escapeHtml(e.titulo||'Ensayo Spirit to All')}</strong><span class="muted">🕐 ${formatearHora(e.hora_inicio)}${e.hora_fin?'–'+formatearHora(e.hora_fin):''}</span>${e.lugar?`<span class="muted">📍 ${escapeHtml(e.lugar)}</span>`:''}<div class="sta-ensayo-acciones"><button type="button" class="btn-light btn-mini" onclick="anadirEnsayoGoogle(${e.ensayo_id})">📅 Añadir a mi calendario</button>${gestor?`<button type="button" class="btn-light btn-mini" onclick="editarEnsayo(${e.ensayo_id})">✏️ Editar</button><button type="button" class="btn-light btn-mini sta-ensayo-eliminar" onclick="eliminarEnsayo(${e.ensayo_id})">Quitar</button>`:''}</div></div>`;
  }).join('');
  items+=fs.map(f=>{
    const titulo=escapeHtml(f.titulo||'Bolo confirmado');
    const hora=f.hora?formatearHora(f.hora)+(f.hora_fin?'–'+formatearHora(f.hora_fin):''):'Hora por confirmar';
    const resumen=`<strong>${titulo}</strong><span class="muted">🕐 ${hora}${f.lugar?' · 📍 '+escapeHtml(f.lugar):''}</span>`;
    const eventoId=Number(f.evento_id);
    const esBolo=f.tipo==='bolo'&&Number(f.id)>0;
    const id=esBolo?Number(f.id):eventoId;
    const origen=esBolo?'bolo':'evento';
    const enlace=eventoId?`<button style="width:100%;text-align:left;background:transparent;border:0;padding:0;color:inherit;box-shadow:none" onclick="seleccionarEvento(${eventoId},'encuestas')">${resumen}</button>`:resumen;
    const mapa=f.lugar?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(f.lugar):'';
    return `<div class="agenda-event agenda-confirm">${enlace}${mapa?`<div class="agenda-calendar-actions"><a class="btn-light" href="${escapeHtml(mapa)}" target="_blank" rel="noopener noreferrer">🗺️ Cómo llegar</a></div>`:''}</div>`;
  }).join('');
  agenda.innerHTML=`<h3>📅 ${formatearFechaLarga(fecha)}</h3>`+(items||'<p class="muted">No hay actividades este día.</p>');
}
async function mostrarResumenEnsayoCalendario(id){
  if(!esGestor())return;
  const caja=document.getElementById('resumenEnsayoCalendario-'+id);if(!caja)return;
  caja.classList.remove('hidden');caja.innerHTML='<span class="muted">Calculando asistencia...</span>';
  const [totalRes,cuerdasRes]=await Promise.all([supabaseClient.rpc('resumen_ensayo',{p_ensayo_id:Number(id)}),supabaseClient.rpc('resumen_ensayo_cuerdas',{p_ensayo_id:Number(id)})]);
  if(totalRes.error||cuerdasRes.error){console.error(totalRes.error||cuerdasRes.error);caja.innerHTML='<span class="muted">No se ha podido cargar el resumen.</span>';return}
  const t=totalRes.data?.[0]||{si:0,no:0,pendientes:0,total:0};const nombreCuerda=id=>CUERDAS.find(c=>Number(c.id)===Number(id))?.nombre||'Sin cuerda';const cuerdas=(cuerdasRes.data||[]).sort((a,b)=>(Number(a.cuerda_id)||99)-(Number(b.cuerda_id)||99));
  caja.innerHTML=`<strong>📊 Asistencia prevista</strong><div class="resumen-ensayo-total"><div><strong>✅ ${t.si||0}</strong><br><span class="muted">Sí</span></div><div><strong>❌ ${t.no||0}</strong><br><span class="muted">No</span></div><div><strong>⏳ ${t.pendientes||0}</strong><br><span class="muted">Pendientes</span></div></div><div class="cuerdas-asistencia">${cuerdas.map(c=>`<div class="cuerda-asistencia"><strong>${escapeHtml(nombreCuerda(c.cuerda_id))}</strong><span>✅ ${c.si||0} · ❌ ${c.no||0} · ⏳ ${c.pendientes||0}</span></div>`).join('')}</div>`;
}


function normalizarUrlYoutube(valor){
  const v=(valor||'').trim();
  if(!v)return '';
  try{
    const u=new URL(v);
    const host=u.hostname.toLowerCase().replace(/^www\./,'');
    if(host==='youtube.com'||host==='m.youtube.com'||host==='youtu.be')return u.href;
  }catch(_){}
  return '';
}
function pintarRepertorioEvento(){
  if(!eventoActual)return;
  const repertorio=(eventoActual.repertorio||'').trim();
  const solistas=(eventoActual.solistas||'').trim();
  const youtube=normalizarUrlYoutube(eventoActual.repertorio_youtube);

  document.getElementById('subtituloModalRepertorio').textContent=eventoActual.titulo||'Evento confirmado';

  const rep=document.getElementById('repertorioVisual');
  rep.textContent=repertorio||'El repertorio todavía no se ha publicado.';
  rep.classList.toggle('repertorio-vacio',!repertorio);

  document.getElementById('solistasVisual').textContent=solistas;
  document.getElementById('bloqueSolistasVisual').classList.toggle('hidden',!solistas);
  document.getElementById('bloqueYoutubeVisual').classList.toggle('hidden',!youtube);

  document.getElementById('btnEditarRepertorio')?.classList.toggle('hidden',!esGestor());
  document.getElementById('edicionRepertorio')?.classList.add('hidden');
  document.getElementById('mensajeRepertorio').textContent='';
}

function abrirRepertorioDesdeLista(id){
  const e=eventosActuales.find(x=>Number(x.id)===Number(id));
  if(!e||e.eliminado||e.estado!=='confirmado')return;
  eventoActual=e;
  abrirRepertorioEvento();
}
function staRepertorioSheetHtml(){
  if(!eventoActual)return '<div class="sta-sheet-intro"><strong>Evento no disponible.</strong></div>';
  const repertorio=(eventoActual.repertorio||'').trim(),solistas=(eventoActual.solistas||'').trim(),youtube=normalizarUrlYoutube(eventoActual.repertorio_youtube);
  const fecha=eventoActual.fecha?formatearFechaCorta(eventoActual.fecha):'';
  const canciones=repertorio?escapeHtml(repertorio).replace(/\n/g,'<br>'):'El repertorio todavía no se ha publicado.';
  const solistasHtml=solistas?`<div class="sta-event-sheet-label">Solistas</div><div class="sta-event-sheet-group"><div class="sta-event-sheet-row"><span class="ico">🎤</span><span class="copy"><small>Asignación</small><strong class="sta-rep-lines">${escapeHtml(solistas).replace(/\n/g,'<br>')}</strong></span><span></span></div></div>`:'';
  const acciones=[youtube?'<button class="btn-primary" type="button" onclick="abrirYoutubeRepertorio()">▶️ Abrir YouTube</button>':'',staTienePermiso('repertorio')?'<button class="btn-light" type="button" onclick="staAbrirEditorRepertorioSheet()">✏️ Editar repertorio</button>':''].filter(Boolean).join('');
  return `<div class="sta-event-sheet-hero"><span class="ico">🎵</span><div><strong>Repertorio</strong><small>${escapeHtml(eventoActual.titulo||'Evento')}${fecha?' · '+escapeHtml(fecha):''}</small></div></div><div class="sta-event-sheet-label">Canciones</div><div class="sta-event-sheet-group"><div class="sta-event-sheet-row"><span class="ico">🎶</span><span class="copy"><small>Repertorio del evento</small><strong class="sta-rep-lines">${canciones}</strong></span><span></span></div></div>${solistasHtml}${acciones?`<div class="sta-sheet-actionbar ${youtube&&esGestor()?'two':''}">${acciones}</div>`:''}`;
}
function staAbrirEditorRepertorioSheet(){
  if(!staTienePermiso('repertorio')||!eventoActual)return;
  const html=`<div class="sta-event-sheet-hero"><span class="ico">✏️</span><div><strong>Editar repertorio</strong><small>${escapeHtml(eventoActual.titulo||'Evento')}</small></div></div><div class="sta-rep-edit-grid"><label class="control-label">Canciones<textarea id="staRepSheetCanciones" placeholder="Una canción por línea">${escapeHtml(eventoActual.repertorio||'')}</textarea></label><label class="control-label">Solistas (opcional)<textarea id="staRepSheetSolistas" placeholder="Canción — solista">${escapeHtml(eventoActual.solistas||'')}</textarea></label><label class="control-label">Enlace de YouTube (opcional)<input id="staRepSheetYoutube" type="url" inputmode="url" value="${escapeHtml(eventoActual.repertorio_youtube||'')}" placeholder="https://youtube.com/..."></label><button class="btn-primary btn-full" type="button" onclick="staGuardarRepertorioSheet()">💾 Guardar repertorio</button><p id="staRepSheetMsg" class="muted"></p></div>`;
  pushStaSheet('Editar repertorio',html,'history');
}
async function staGuardarRepertorioSheet(){
  if(!staTienePermiso('repertorio')||!eventoActual)return;
  const repertorio=(document.getElementById('staRepSheetCanciones')?.value||'').trim(),solistas=(document.getElementById('staRepSheetSolistas')?.value||'').trim(),youtubeRaw=(document.getElementById('staRepSheetYoutube')?.value||'').trim(),youtube=youtubeRaw?normalizarUrlYoutube(youtubeRaw):'',msg=document.getElementById('staRepSheetMsg');
  if(youtubeRaw&&!youtube){if(msg)msg.textContent='El enlace debe ser de YouTube.';return}
  if(msg)msg.textContent='Guardando…';
  const {data,error}=await supabaseClient.rpc('sta_guardar_repertorio',{p_evento_id:eventoActual.id,p_repertorio:repertorio||null,p_solistas:solistas||null,p_youtube:youtube||null}).single();
  if(error){console.error(error);if(msg)msg.textContent='No se ha podido guardar. '+(error.message||'');return}
  eventoActual={...eventoActual,...data};const idx=eventosActuales.findIndex(e=>Number(e.id)===Number(eventoActual.id));if(idx>=0)eventosActuales[idx]={...eventosActuales[idx],...data};
  staSheetHistory=[];abrirStaSheet('Repertorio',staRepertorioSheetHtml(),'event-detail');
}
function abrirRepertorioEvento(){
  if(!eventoActual||eventoActual.eliminado||eventoActual.estado!=='confirmado')return;
  abrirStaSheet('Repertorio',staRepertorioSheetHtml(),detalleEncuestaAbierto()?'event-detail':null);
}
function cerrarRepertorioEvento(){
  document.getElementById('modalRepertorio')?.classList.add('hidden');
  document.body.style.overflow='';
}
function mostrarEdicionRepertorio(){
  if(!staTienePermiso('repertorio')||!eventoActual)return;
  document.getElementById('repertorioInput').value=eventoActual.repertorio||'';
  document.getElementById('solistasInput').value=eventoActual.solistas||'';
  document.getElementById('repertorioYoutubeInput').value=eventoActual.repertorio_youtube||'';
  document.getElementById('edicionRepertorio').classList.remove('hidden');
  document.getElementById('mensajeRepertorio').textContent='';
}
function abrirYoutubeRepertorio(){
  if(!eventoActual)return;
  const url=normalizarUrlYoutube(eventoActual.repertorio_youtube);
  if(!url){alert('No hay un enlace de YouTube válido para este evento.');return}
  window.open(url,'_blank','noopener,noreferrer');
}
async function guardarRepertorioEvento(){
  if(!staTienePermiso('repertorio')||!eventoActual)return;
  const repertorio=(document.getElementById('repertorioInput').value||'').trim();
  const solistas=(document.getElementById('solistasInput').value||'').trim();
  const youtubeRaw=(document.getElementById('repertorioYoutubeInput').value||'').trim();
  const youtube=youtubeRaw?normalizarUrlYoutube(youtubeRaw):'';
  const mensaje=document.getElementById('mensajeRepertorio');

  if(youtubeRaw&&!youtube){
    mensaje.textContent='El enlace debe ser de YouTube.';
    return;
  }

  mensaje.textContent='Guardando...';
  const {data,error}=await supabaseClient.rpc('sta_guardar_repertorio',{p_evento_id:eventoActual.id,p_repertorio:repertorio||null,p_solistas:solistas||null,p_youtube:youtube||null}).single();

  if(error){
    console.error(error);
    mensaje.textContent='No se ha podido guardar el repertorio. '+(error.message||'');
    return;
  }

  eventoActual={...eventoActual,...data};
  const idx=eventosActuales.findIndex(e=>Number(e.id)===Number(eventoActual.id));
  if(idx>=0)eventosActuales[idx]={...eventosActuales[idx],...data};

  mensaje.textContent='✅ Repertorio guardado.';
  pintarRepertorioEvento();
}
