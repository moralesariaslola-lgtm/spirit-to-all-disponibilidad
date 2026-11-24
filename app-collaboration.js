// Spirit to All · Experiencia móvil y colaboración · 2026-10-26
// Los permisos se comprueban igualmente en Supabase; ocultar una pantalla no protege datos.
let staEquipoResponsables = [], staEquipoPromesa = null, staEquipoCargado = false;
const STA_DEPARTAMENTOS = [
 {id:'comercial',label:'Distribución comercial',ico:'💼'},
 {id:'marketing',label:'Marketing',ico:'📣'},
 {id:'creatividad',label:'Creatividad',ico:'🎨'},
 {id:'logistica',label:'Logística',ico:'🚚'}
];
async function staEquipoCargar(recargar=false){
  if(staEquipoCargado&&!recargar)return;
  if(staEquipoPromesa)return staEquipoPromesa;
  staEquipoPromesa=(async()=>{
    try{
      const {data,error}=await supabaseClient.rpc('sta_equipo_responsables');
      if(error)throw error;
      staEquipoResponsables=(data||[]).map(u=>({id:String(u.usuario_id),nombre:String(u.nombre||''),rol:String(u.rol||'miembro'),areas:u.areas||[]}));
      staEquipoCargado=true;
    }catch(e){console.warn('No se pudo cargar la clasificación de equipos',e);
      // Mantiene el buscador disponible con datos básicos sin conceder permisos adicionales.
      staEquipoResponsables=staTaskUsuarios.map(u=>({...u,rol:'miembro',areas:[]}));
    }
  })();
  try{await staEquipoPromesa}finally{staEquipoPromesa=null}
}
function staPersonaNombre(id){return staTaskUsuarios.find(u=>u.id===String(id||''))?.nombre||''}
function staPersonaPicker(id,actual,modo='tarea',area=''){
  const uid=modo==='tarea'?String(actual||''):'';
  const nombre=modo==='tarea'?staPersonaNombre(uid):String(actual||'');
  const value=modo==='tarea'?uid:nombre;
  return `<div class="sta-person-picker"><input type="search" id="${escapeHtml(id)}__busca" autocomplete="off" value="${escapeHtml(nombre)}" placeholder="Buscar persona por nombre…" aria-label="Buscar responsable" oninput="staPickerBuscar('${id}','${modo}','${area}')" onfocus="staPickerBuscar('${id}','${modo}','${area}',true)"><input type="hidden" id="${escapeHtml(id)}" value="${escapeHtml(value)}"><button type="button" class="sta-picker-reset" onclick="staPickerLimpiar('${id}')" aria-label="Quitar responsable">×</button><div class="sta-picker-results hidden" id="${escapeHtml(id)}__resultados"></div></div>`;
}
function staPickerLimpiar(id){
 const buscador=document.getElementById(id+'__busca'),valor=document.getElementById(id),result=document.getElementById(id+'__resultados');
 if(buscador)buscador.value='';if(valor)valor.value='';if(result){result.innerHTML='';result.classList.add('hidden')}
 if(id==='prodOppTaskUsuario'){
  const externo=document.getElementById('prodOppTaskResp');if(externo)externo.value='';
 } else if(id.startsWith('prodTaskUsuario-')){
  const externo=document.getElementById('prodTaskResp-'+id.split('-').pop());if(externo)externo.value='';
 }
}
function staPickerBuscar(id,modo='tarea',area='',soloFoco=false){
 const inp=document.getElementById(id+'__busca'),campo=document.getElementById(id),out=document.getElementById(id+'__resultados');if(!inp||!campo||!out)return;
 const txt=inp.value.trim();
 if(!soloFoco)campo.value='';
 // Preservar nombres antiguos mientras no se cambie la selección: escritura sin elegir no asigna usuarios.
 if(txt.length<2){out.innerHTML='<div class="sta-picker-hint">Escribe al menos 2 letras para buscar.</div>';out.classList.remove('hidden');return}
 const normal=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const q=normal(txt);
 let lista=(modo==='tarea'?staTaskUsuarios:staEquipoResponsables.filter(u=>['admin','gestor'].includes(u.rol)));
 lista=lista.filter(u=>normal(u.nombre).includes(q)).sort((a,b)=>Number((b.areas||[]).includes(area))-Number((a.areas||[]).includes(area))||a.nombre.localeCompare(b.nombre,'es')).slice(0,8);
 out.innerHTML=lista.length?lista.map(u=>`<button class="sta-picker-result" type="button" onclick="staPickerElegir('${id}','${escapeHtml(u.id)}','${modo}')"><strong>${escapeHtml(u.nombre)}</strong><small>${escapeHtml((u.areas||[]).includes(area)?'De este departamento':modo==='coordinacion'?(u.rol==='admin'?'Admin':'Gestor'):'Miembro del coro')}</small></button>`).join(''):'<div class="sta-picker-hint">Ninguna coincidencia. Prueba con otro nombre.</div>';
 out.classList.remove('hidden');
}
function staPickerElegir(id,uid,modo){
 const u=staTaskUsuarios.find(x=>x.id===uid)||staEquipoResponsables.find(x=>x.id===uid);if(!u)return;
 const inp=document.getElementById(id+'__busca'),out=document.getElementById(id+'__resultados'),campo=document.getElementById(id);
 if(inp)inp.value=u.nombre;if(campo)campo.value=modo==='coordinacion'?u.nombre:u.id;
 if(out)out.classList.add('hidden');
 if(id==='prodOppTaskUsuario'){
   const externo=document.getElementById('prodOppTaskResp');if(externo)externo.value=u.nombre;
 } else if(id.startsWith('prodTaskUsuario-')){
   const externo=document.getElementById('prodTaskResp-'+id.split('-').pop());if(externo)externo.value=u.nombre;
 }
}
// Cierra un buscador tocando fuera; los botones no pierden el clic.
document.addEventListener('pointerdown',ev=>{
 if(ev.target.closest('.sta-person-picker'))return;
 document.querySelectorAll('.sta-picker-results').forEach(el=>el.classList.add('hidden'));
});
async function staPermisosAbrirEditor(uid){
 const [{data,error},estado]=await Promise.all([
   supabaseClient.rpc('sta_permisos_usuario',{p_usuario:uid}),
   supabaseClient.rpc('sta_accesos_activados',{p_usuario:uid})
 ]);
 if(error||estado.error){alert('No se pudieron cargar los permisos.');return}
 const gestor=staEquipoResponsables.find(u=>u.id===String(uid))?.rol==='gestor';
 const opciones={encuestas:['Gestionar encuestas','Crear y gestionar encuestas de disponibilidad.'],contabilidad:['Contabilidad y documentos','Consultar y gestionar la economía y su documentación.'],vestuario:['Publicar vestuario','Editar las indicaciones de vestuario de los bolos.'],repertorio:['Editar repertorio','Modificar canciones, solistas y enlaces del repertorio.']};
 abrirStaSheet('Permisos individuales',`<fieldset id="staPermisosPersona"><legend>Accesos adicionales</legend>${
   Object.entries(opciones).map(([id,[etiqueta,descripcion]])=>`<label class="btn-light btn-full sta-permission-option"><input type="checkbox" value="${id}" ${data?.includes(id)?'checked':''}><span class="sta-permission-copy"><strong>${etiqueta}</strong><small>${descripcion}</small></span></label>`).join('')
 }</fieldset>${gestor?`<label id="staActivarAccesosPersonaLabel" class="btn-light btn-full"><input type="checkbox" id="staActivarAccesosPersona" ${estado.data?'checked':''}><span class="sta-permission-copy"><strong>Aplicar permisos por departamento y accesos individuales</strong></span></label><p>Al activarlos, este gestor tendrá acceso a sus departamentos y a los módulos seleccionados arriba.</p>`:''}<button type="button" class="btn-primary btn-full" onclick="staPermisosGuardarEditor('${escapeHtml(uid)}',this)">Guardar permisos</button><p id="staPermisosPersonaMsg" role="status"></p>`);
}
async function staPermisosGuardarEditor(uid,boton){
 const permisos=[...document.querySelectorAll('#staPermisosPersona input:checked')].map(i=>i.value);
 const mensaje=document.getElementById('staPermisosPersonaMsg');
 boton.disabled=true;
 try{
   const {error}=await supabaseClient.rpc('sta_configurar_accesos_usuario',{p_usuario:uid,p_permisos:permisos,p_activar:document.getElementById('staActivarAccesosPersona')?.checked===true});
   mensaje.textContent=error?'No se pudieron guardar los permisos.':'Permisos guardados.';
 }finally{boton.disabled=false}
}
function staUsuariosAreasEditor(uid){
 const u=staEquipoResponsables.find(x=>x.id===uid),areas=u?.areas||[];
 return `<div class="sta-user-depts"><button class="btn-light" type="button" onclick="staPermisosAbrirEditor('${escapeHtml(uid)}')">Permisos individuales</button><fieldset><legend>Departamentos de gestión</legend>${STA_DEPARTAMENTOS.map(a=>`<label><input type="checkbox" data-sta-area="${a.id}" data-sta-user="${escapeHtml(uid)}" ${areas.includes(a.id)?'checked':''}> ${escapeHtml(a.label)}</label>`).join('')}</fieldset><button type="button" class="btn-light" onclick="staUsuariosGuardarAreas('${escapeHtml(uid)}')">Guardar departamentos</button><small id="staAreasMsg-${escapeHtml(uid)}" class="muted"></small></div>`;
}
async function staUsuariosGuardarAreas(uid){
 if(!esAdmin())return;
 const arr=[...document.querySelectorAll('input[data-sta-user="'+uid+'"]:checked')].map(x=>x.dataset.staArea);
 const msg=document.getElementById('staAreasMsg-'+uid);if(msg)msg.textContent='Guardando…';
 const {error}=await supabaseClient.rpc('sta_asignar_areas_usuario',{p_usuario_id:uid,p_areas:arr});
 if(error){if(msg)msg.textContent='Error: '+error.message;return}
 await staEquipoCargar(true);if(msg)msg.textContent='✓ Departamentos guardados';
}

let staColabTareas=[],staColabArea='todas',staColabFiltro='abiertas',staColabCargando=false;
function staColabTieneSesion(){return Boolean(usuarioActual?.id&&perfilActual?.aprobado&&!perfilActual?.eliminado)}
async function staColabActualizarInicio(){
 if(!staColabTieneSesion())return;
 const {data,error}=await supabaseClient.rpc('sta_colab_listar');if(error)return;
 staColabTareas=Array.isArray(data)?data:[];
 const abiertas=staColabTareas.filter(t=>t.estado==='abierta'&&
   Number(t.plazas||1)>(t.inscritos||[]).length&&
   !(t.inscritos||[]).some(x=>x.id===usuarioActual.id));
 const badge=document.getElementById('staColabBadge');if(badge){badge.textContent=abiertas.length?' · '+abiertas.length+' disponible'+(abiertas.length===1?'':'s'):'';badge.classList.toggle('hidden',!abiertas.length)}
 const reciente=abiertas.reduce((a,b)=>!a||Number(b.id)>Number(a.id)?b:a,null),aviso=document.getElementById('staColabAvisoInicio');
 if(!aviso)return;
 let visto=0;try{visto=Number(localStorage.getItem('sta-colab-visto:'+usuarioActual.id)||0)}catch(_){}
 if(!reciente||Number(reciente.id)<=visto){aviso.classList.add('hidden');return}
 const dep=STA_DEPARTAMENTOS.find(a=>a.id===reciente.area);
 aviso.innerHTML=`<strong>🔴 NOVEDAD · Nueva tarea de ${escapeHtml(dep?.label||'Spirit')}</strong><span>${escapeHtml(reciente.titulo)}</span><button class="btn-primary" type="button" onclick="staColabVerNovedad(${Number(reciente.id)})">Ver y apuntarme</button>`;
 aviso.classList.remove('hidden');
}
function staColabVerNovedad(id){
 try{localStorage.setItem('sta-colab-visto:'+usuarioActual.id,String(id))}catch(_){}
 document.getElementById('staColabAvisoInicio')?.classList.add('hidden');staColabAbrir();
}
async function staColabAbrir(){
 abrirStaSheet('Echa una mano','<div class="sta-help-head"><strong>🤝 Echa una mano</strong><p>Buscando las tareas en las que puedes colaborar…</p></div>');
 if(esGestor())await staEquipoCargar(true);
 await staColabRecargar();
}
async function staColabRecargar(){
 if(staColabCargando)return;
 staColabCargando=true;
 try{
   const {data,error}=await supabaseClient.rpc('sta_colab_listar');
   if(error)throw error;
   staColabTareas=Array.isArray(data)?data:[];
   staColabRender();void staColabActualizarInicio();
 }catch(e){console.error('Tablón de colaboración',e);const b=document.getElementById('staSheetBody');if(b)b.innerHTML=`<div class="sta-help-head"><strong>No se pudo abrir el tablón</strong><p>${escapeHtml(e.message||'Inténtalo de nuevo.')}</p></div><button class="btn-light btn-full" onclick="staColabRecargar()">Reintentar</button>`}
 finally{staColabCargando=false}
}
function staColabRender(){
 const b=document.getElementById('staSheetBody');if(!b)return;
 const gestor=STA_DEPARTAMENTOS.some(a=>staGestionaArea(a.id));
 let tareas=staColabTareas;
 if(staColabArea!=='todas')tareas=tareas.filter(x=>x.area===staColabArea);
 if(staColabFiltro==='mias')tareas=tareas.filter(x=>(x.inscritos||[]).some(y=>y.id===usuarioActual?.id));
 if(staColabFiltro==='abiertas')tareas=tareas.filter(x=>x.estado==='abierta'&&Number(x.plazas||1)>(x.inscritos||[]).length);
 const filtro=(v,l)=>`<button type="button" class="sta-help-tab ${staColabFiltro===v?'active':''}" onclick="staColabFiltro='${v}';staColabRender()">${l}</button>`;
 const areaBtn=(v,l)=>`<button type="button" class="sta-help-tab ${staColabArea===v?'active':''}" onclick="staColabArea='${v}';staColabRender()">${l}</button>`;
 b.innerHTML=`<div class="sta-help-head"><strong>🤝 Echa una mano</strong><p>Pequeñas tareas para sacar adelante el coro. No tienes que pertenecer al departamento. Pulsa «Me apunto» y quedará registrado tu nombre.</p></div>
 <div class="sta-help-tabs" aria-label="Ver tareas">${filtro('abiertas','Disponibles')}${filtro('mias','Mis tareas')}${filtro('todas','Todas')}</div>
 <div class="sta-help-tabs" aria-label="Filtrar departamento">${areaBtn('todas','Todos')}${STA_DEPARTAMENTOS.map(a=>areaBtn(a.id,a.ico+' '+a.label)).join('')}</div>
 ${gestor?`<button class="btn-primary btn-full" style="margin:0 0 12px" type="button" onclick="staColabEditar(null)">＋ Publicar tarea para el coro</button>`:''}
 ${tareas.length?tareas.map(staColabTarjeta).join(''):'<div class="sta-crm-empty">Por ahora no hay tareas con este filtro.</div>'}`;
}
function staColabTarjeta(t){
 const dep=STA_DEPARTAMENTOS.find(a=>a.id===t.area),ins=t.inscritos||[],miInscripcion=ins.find(x=>x.id===usuarioActual?.id),yo=!!miInscripcion,libres=Math.max(0,Number(t.plazas||1)-ins.length),cerrada=t.estado==='cerrada';
 const boton=cerrada?'Cerrada':miInscripcion?.completada_en?'✅ He terminado':yo?'✓ Me he apuntado':libres?'Me apunto':'Plazas cubiertas';
 return `<article class="sta-help-card"><div class="sta-help-top"><span>${dep?.ico||'📋'} ${escapeHtml(dep?.label||'Departamento')}</span><small>${t.estado==='en_curso'?'En curso':cerrada?'Cerrada':'Abierta'}</small></div><h4>${escapeHtml(t.titulo)}</h4>${t.descripcion?`<p>${escapeHtml(t.descripcion)}</p>`:''}
 <small>${t.fecha_limite?'📅 Antes del '+escapeHtml(formatearFechaCorta(t.fecha_limite))+' · ':''}👥 ${ins.length}/${Number(t.plazas||1)} persona${t.plazas===1?'':'s'} apuntada${t.plazas===1?'':'s'}</small>
 ${ins.length?`<p class="sta-help-joined">${ins.map(x=>`${escapeHtml(x.nombre)}${x.completada_en?' · ✅ Realizada':' · Apuntado/a'}`).join('<br>')}</p>`:''}
 <div class="sta-help-footer"><button class="sta-help-btn ${yo?'leave':''}" type="button" ${cerrada||miInscripcion?.completada_en||(!yo&&!libres)?'disabled':''} onclick="staColabApuntarme(${Number(t.id)},${yo?'false':'true'},this)">${boton}</button>${yo&&!miInscripcion?.completada_en&&!cerrada?`<button class="sta-inline-action" type="button" onclick="staColabCompletar(${Number(t.id)},this)">✅ Marcar mi parte como realizada</button>`:''}${staGestionaArea(t.area)?`<button class="sta-inline-action" type="button" onclick="staColabEditar(${Number(t.id)})">✎ Gestionar</button>`:''}${!cerrada&&(esAdmin()||t.creado_por===usuarioActual?.id)?`<button class="sta-inline-action" type="button" onclick="staColabEnviarPush(${Number(t.id)},this)">🔔 Enviar aviso push</button>`:''}</div></article>`;
}
async function staColabAvisarAutor(id,tipo){
 try{
  const {data,error}=await supabaseClient.functions.invoke('avisos-colaboracion',{body:{tipo,tarea_id:Number(id)}});
  if(error||!data?.ok)console.warn('La participación se guardó, pero el aviso al autor no se confirmó:',error||data?.error);
 }catch(error){console.warn('La participación se guardó, pero el aviso al autor no se confirmó:',error)}
}
async function staColabCompletar(id,button){
 if(button)button.disabled=true;
 const {data,error}=await supabaseClient.rpc('sta_colab_completar',{p_tarea_id:Number(id)});
 if(error){alert('No se pudo marcar como realizada: '+error.message);if(button)button.disabled=false;return}
 if(data===true)await staColabAvisarAutor(id,'completado');
 await staColabRecargar();
}
async function staColabEnviarPush(id,boton){
 if(boton)boton.disabled=true;
 try{
  const {data,error}=await supabaseClient.functions.invoke('avisos-colaboracion',{body:{tarea_id:Number(id)}});
  if(error||!data?.ok)throw new Error(data?.error||error?.message||'Error de envío');
  alert(data.enviados?`Aviso enviado a ${data.enviados} dispositivo(s).`:'No había dispositivos activos para recibir el aviso. La tarea sigue visible en la app.');
 }catch(e){alert('No se pudo enviar el aviso: '+e.message)}finally{if(boton)boton.disabled=false}
}
async function staColabApuntarme(id,apuntar,button){
 if(button)button.disabled=true;
 const {data,error}=await supabaseClient.rpc('sta_colab_apuntarme',{p_tarea_id:Number(id),p_apuntar:Boolean(apuntar)});
 if(error){alert('No se ha podido actualizar tu inscripción: '+error.message);if(button)button.disabled=false;return}
 if(apuntar&&data===true)await staColabAvisarAutor(id,'apuntado');
 await staColabRecargar();
}
function staColabEditar(id){
 if(!esGestor())return;
 const t=staColabTareas.find(x=>Number(x.id)===Number(id))||{};
 const areas=STA_DEPARTAMENTOS.filter(a=>staGestionaArea(a.id));
 if(!areas.length||(id&&!staGestionaArea(t.area)))return;
 pushStaSheet(id?'Editar tarea pública':'Publicar tarea',`<div class="sta-help-editor"><div class="sta-sheet-intro"><strong>Una tarea abierta para ayudar</strong><p>Esta información será visible para todas las personas aprobadas del coro. No escribas datos privados ni decisiones de Junta.</p></div>
 <label>Departamento<select id="colabArea">${areas.map(a=>`<option value="${a.id}" ${t.area===a.id?'selected':''}>${escapeHtml(a.label)}</option>`).join('')}</select></label>
 <label>¿Qué hay que hacer?<input id="colabTitulo" maxlength="160" value="${escapeHtml(t.titulo||'')}" placeholder="Ej.: Ayudar con los carteles"></label>
 <label>Descripción<textarea id="colabDescripcion" maxlength="1500" rows="3" placeholder="Explica la tarea y qué se necesita">${escapeHtml(t.descripcion||'')}</textarea></label>
 <label>Fecha límite (opcional)<input id="colabFecha" type="date" value="${escapeHtml(t.fecha_limite||'')}"></label>
 <label>¿Cuántas personas se necesitan?<input id="colabPlazas" type="number" min="1" max="40" value="${Number(t.plazas||1)}"></label>
 <label>Estado<select id="colabEstado"><option value="abierta" ${!t.estado||t.estado==='abierta'?'selected':''}>Abierta: pueden apuntarse</option><option value="en_curso" ${t.estado==='en_curso'?'selected':''}>En curso: sin nuevas inscripciones</option><option value="cerrada" ${t.estado==='cerrada'?'selected':''}>Terminada / cerrada</option></select></label>
 <div id="colabGuardarMsg" class="muted" role="status"></div><button id="colabGuardarBtn" class="btn-primary btn-full" onclick="staColabGuardar(${id?Number(id):'null'})">Guardar tarea</button></div>`);
}
async function staColabGuardar(id){
 if(!esGestor())return;
 const titulo=document.getElementById('colabTitulo')?.value.trim()||'',msg=document.getElementById('colabGuardarMsg'),btn=document.getElementById('colabGuardarBtn');
 if(titulo.length<3){if(msg)msg.textContent='Escribe un título de al menos 3 caracteres.';return}
 const plazas=Number(document.getElementById('colabPlazas')?.value||1);
 if(!Number.isInteger(plazas)||plazas<1||plazas>40){if(msg)msg.textContent='Elige de 1 a 40 personas.';return}
 const estadoNuevo=document.getElementById('colabEstado')?.value||'abierta';
 if(btn)btn.disabled=true;if(msg)msg.textContent='Guardando…';
 const {data,error}=await supabaseClient.rpc('sta_colab_guardar',{
  p_id:id,p_area:document.getElementById('colabArea')?.value,
  p_titulo:titulo,p_descripcion:document.getElementById('colabDescripcion')?.value.trim()||'',
  p_fecha_limite:document.getElementById('colabFecha')?.value||null,p_plazas:plazas,
  p_estado:estadoNuevo
 });
 if(error){if(msg)msg.textContent='No se pudo guardar: '+error.message;if(btn)btn.disabled=false;return}
 volverStaSheet();await staColabRecargar();
 if(!id&&estadoNuevo==='abierta')await staColabEnviarPush(Number(data));
}

