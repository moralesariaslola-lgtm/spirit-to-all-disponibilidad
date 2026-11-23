/* Gestión móvil profesional: navegación por profundidad + hojas de detalle */

var staPendientesTotal=0;
var staSheetHistory=[];

(function(){
  if(typeof mostrarVistaGestionEncuestas==='function'){
    const baseMostrarVista=mostrarVistaGestionEncuestas;
    mostrarVistaGestionEncuestas=function(vista){
      baseMostrarVista(vista);
      const panel=document.getElementById('panelGestor');
      const deep=['evento','fecha','editar'].includes(vista);
      panel?.classList.toggle('gestion-app-deep',deep);
      if(deep)requestAnimationFrame(()=>panel?.scrollTo?.({top:0,behavior:'instant'}));
    };
  }
})();

function staManualWebUrl(){
  const url=new URL(window.location.origin+window.location.pathname);
  url.searchParams.set('manual','1');
  return url.href;
}
function abrirManualWeb(){
  const url=staManualWebUrl();
  const nueva=window.open(url,'_blank','noopener');
  if(!nueva)window.location.href=url;
}
async function staCompartirManualWeb(){
  const url=staManualWebUrl();
  try{
    if(navigator.share){await navigator.share({title:'Manual de Spirit to All',text:'Manual de usuario de Spirit to All',url});return}
    await navigator.clipboard.writeText(url);alert('✅ Enlace del manual copiado.');
  }catch(err){if(err?.name!=='AbortError'){prompt('Copia este enlace del manual:',url)}}
}
async function abrirManualUsuario(){
  if(!usuarioActual?.id||!perfilActual?.aprobado||perfilActual?.eliminado){await comprobarUsuario();return}
  abrirStaSheet('Manual de usuario','<div class="sta-sheet-intro" role="status">Cargando manual protegido…</div>');
  const body=document.getElementById('staSheetBody');
  try{
    const {data,error}=await supabaseClient.rpc('obtener_manual_spirit');
    if(error)throw error;
    if(!data||typeof data.html!=='string'||!Array.isArray(data.temas))throw new Error('Manual no disponible');
    if(!body||document.getElementById('staSheetBackdrop')?.classList.contains('hidden'))return;
    STA_MANUAL_TEMAS=data.temas;
    body.innerHTML=data.html;
    comprobarArchivosManual();
  }catch(err){
    console.error('No se pudo consultar el manual protegido',err);
    if(body&&!document.getElementById('staSheetBackdrop')?.classList.contains('hidden'))body.innerHTML='<div class="sta-sheet-intro" role="alert"><strong>No se puede abrir el manual</strong><p>Comprueba tu conexión y que tu cuenta esté aprobada. Si tu sesión ha terminado, vuelve a iniciar sesión.</p><button class="btn-light" type="button" onclick="cerrarStaSheet();comprobarUsuario()">Comprobar mi acceso</button></div>';
  }
}
async function comprobarArchivosManual(){
  const box=document.getElementById('staManualDocs');if(!box)return;
  const disponibles=[`<a class="btn-primary" href="${escapeHtml(staManualWebUrl())}" target="_blank" rel="noopener">🌐 Abrir enlace protegido</a>`,`<button type="button" class="btn-light" onclick="staCompartirManualWeb()">🔗 Compartir enlace</button>`];
  box.innerHTML=disponibles.join('');box.classList.remove('hidden');
}
function filtrarManualUsuario(valor){
  const q=String(valor||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const items=[...document.querySelectorAll('#staManualLista .sta-manual-section')];let visibles=0;
  items.forEach(d=>{const texto=(String(d.dataset.manual||'')+' '+String(d.textContent||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const ok=!q||texto.includes(q);d.classList.toggle('hidden',!ok);if(ok)visibles++});
  document.getElementById('staManualSinResultados')?.classList.toggle('hidden',visibles>0);
}
let STA_MANUAL_TEMAS=[];
function staManualNormalizar(s){return String(s||'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ]+/g,' ').trim()}
function staPreguntaEjemploManual(q){const campo=document.getElementById('staManualPregunta');if(campo)campo.value=q;staResponderManual()}
function staResponderManual(event){
  event?.preventDefault();const q=staManualNormalizar(document.getElementById('staManualPregunta')?.value),box=document.getElementById('staManualRespuesta');if(!box)return;
  if(!q){box.classList.add('hidden');return}
  const palabras=q.split(' ').filter(w=>w.length>2&&!['como','donde','puedo','para','quiero','esta','este','una','uno','los','las','del','que','con','por','hay','ver','hago'].includes(w));
  const ranked=STA_MANUAL_TEMAS.map((tema,i)=>{const claves=staManualNormalizar(tema.claves),texto=staManualNormalizar(tema.titulo+' '+tema.ruta+' '+tema.pasos),titulo=staManualNormalizar(tema.titulo).split(' ');let score=0;for(const w of palabras){if(claves.split(' ').includes(w))score+=4;else if(w.length>4&&claves.includes(w.slice(0,-1)))score+=2;if(texto.split(' ').includes(w))score+=1;if(titulo.some(t=>w.length>4&&t.startsWith(w)))score+=3}return {tema,i,score}}).sort((a,b)=>b.score-a.score);
  const mejores=ranked.filter(x=>x.score>=3).slice(0,1);
  if(!mejores.length){box.innerHTML='<strong>No tengo una respuesta fiable para esa consulta.</strong><p>Prueba con otra palabra o recorre los apartados del manual. La búsqueda se basa en el contenido de esta guía.</p>';box.classList.remove('hidden');return}
  box.innerHTML=`<h3>Esto es lo que he encontrado</h3>${mejores.map(({tema,i})=>`<article><strong>${escapeHtml(tema.titulo)}</strong><p class="sta-manual-ruta">📍 ${escapeHtml(tema.ruta)}</p><p>${escapeHtml(tema.pasos)}</p><figure class="sta-manual-figure"><img src="${escapeHtml(tema.imagen)}" alt="Vista orientativa de ${escapeHtml(tema.titulo)}" loading="lazy"><figcaption>Imagen orientativa; las opciones visibles dependen de tu rol.</figcaption></figure><button type="button" class="btn-light" onclick="staManualAbrirTema(${i})">Leer instrucciones completas ↓</button></article>`).join('')}`;
  box.classList.remove('hidden');box.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function staManualAbrirTema(i){const tema=STA_MANUAL_TEMAS[i];if(!tema)return;const target=document.querySelector('#staManualLista .sta-manual-section[data-manual-id="'+tema.seccion+'"]');if(!target)return;const filtro=document.getElementById('staManualBuscar');if(filtro){filtro.value='';filtrarManualUsuario('')}target.open=true;target.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.querySelector('summary')?.focus({preventScroll:true})}

let staFocoAntesDeHoja=null;
function abrirStaSheet(titulo,html,volver=null){
  const back=document.getElementById('staSheetBackdrop');
  if(!back)return;
  if(back.classList.contains('hidden')){
    staFocoAntesDeHoja=document.activeElement;
    document.querySelector('main').inert=true;
    document.querySelector('body>header').inert=true;
    document.getElementById('staFixedScreenNav').inert=true;
  }
  document.getElementById('staSheetTitle').textContent=titulo||'Detalle';
  document.getElementById('staSheetBody').innerHTML=html||'';
  const btn=document.getElementById('staSheetBack');
  btn.classList.remove('hidden');
  btn.dataset.action=volver||'close';
  back.classList.remove('hidden');
  document.body.classList.add('sta-sheet-open');
  document.getElementById('staSheetBody').scrollTop=0;
  document.getElementById('staSheetTitle').focus({preventScroll:true});
}
function cerrarStaSheet(){
  const back=document.getElementById('staSheetBackdrop');
  if(back&&!back.classList.contains('hidden')){
    back.classList.add('hidden');
    document.querySelector('main').inert=false;
    document.querySelector('body>header').inert=false;
    document.getElementById('staFixedScreenNav').inert=false;
    if(staFocoAntesDeHoja?.isConnected)staFocoAntesDeHoja.focus({preventScroll:true});
    staFocoAntesDeHoja=null;
  }
  document.body.classList.remove('sta-sheet-open');
  staSheetHistory=[];
}
function pushStaSheet(titulo,html,volverAction){
  const title=document.getElementById('staSheetTitle')?.textContent||'';
  const body=document.getElementById('staSheetBody')?.innerHTML||'';
  const restaurar=document.getElementById('staFichaBoloContenido')?.staRestaurar;
  staSheetHistory.push({title,body,restaurar});
  abrirStaSheet(titulo,html,volverAction||'history');
}
function volverStaSheet(){
  const prev=staSheetHistory.pop();
  if(prev){
    document.getElementById('staSheetTitle').textContent=prev.title;
    document.getElementById('staSheetBody').innerHTML=prev.body;
    if(prev.restaurar)prev.restaurar(document.getElementById('staFichaBoloContenido'));
    document.getElementById('staSheetBack').classList.remove('hidden');
    document.getElementById('staSheetBody').scrollTop=0;
    return;
  }
  cerrarStaSheet();
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('staSheetBackdrop')?.classList.contains('hidden'))cerrarStaSheet()});

function staNombreCuerda(id){return CUERDAS.find(c=>Number(c.id)===Number(id))?.nombre||'Sin cuerda'}
async function abrirPendientesRapido(){
  if(staPendientesTotal<=0)return;
  const html=`<div class="sta-sheet-intro"><strong>⏳ ${staPendientesTotal===1?'1 persona pendiente':`${staPendientesTotal} personas pendientes`}</strong><p>Todavía no han respondido a esta fecha.</p></div><div class="sta-sheet-actions"><button class="sta-action-secondary" type="button" onclick="mostrarListaPendientesSheet()">Ver quién falta ›</button><button class="sta-action-primary sta-icon-action" type="button" onclick="mostrarConfirmacionRecordatorioSheet()" aria-label="Enviar recordatorio" title="Enviar recordatorio">🔔</button></div><div id="staPendingMsg" class="sta-sheet-message"></div>`;
  abrirStaSheet('Pendientes',html);
}
async function mostrarListaPendientesSheet(){
  if(!esGestor()||!fechaGestorSeleccionada)return;
  const body=document.getElementById('staSheetBody');
  if(body)body.innerHTML='<div class="sta-sheet-intro"><strong>Cargando pendientes…</strong></div>';
  const{data,error}=await supabaseClient.rpc('pendientes_fecha_evento',{p_fecha_evento_id:fechaGestorSeleccionada});
  if(error){console.error(error);if(body)body.innerHTML='<div class="sta-sheet-intro"><strong>No se ha podido cargar la lista.</strong></div>';return}
  const arr=data||[];
  const html=`<div class="sta-sheet-intro"><strong>${arr.length===1?'1 persona pendiente':`${arr.length} personas pendientes`}</strong><p>Personas que todavía no han respondido a esta fecha.</p></div>`+
    (arr.length?`<div class="sta-sheet-list">${arr.map(p=>`<div class="sta-person-row"><strong>${escapeHtml(p.nombre||'Sin nombre')}</strong><small>${escapeHtml(p.cuerda_nombre||'Sin cuerda')}</small></div>`).join('')}</div>`:'<div class="sta-sheet-intro"><strong>Todo el mundo ha respondido.</strong></div>')+
    (arr.length?`<div class="sta-sheet-actions"><button class="sta-action-primary" type="button" onclick="mostrarConfirmacionRecordatorioSheet()">🔔 Recordar a pendientes</button></div>`:'');
  if(body)body.innerHTML=html;
}
function mostrarConfirmacionRecordatorioSheet(){
  pushStaSheet('Enviar recordatorio',`<div class="sta-sheet-intro"><strong>🔔 ¿Enviar recordatorio?</strong><p>Se enviará una notificación a quienes continúen pendientes y tengan notificaciones activadas.</p></div><div class="sta-sheet-actions"><button class="sta-action-secondary" type="button" onclick="volverStaSheet()">Cancelar</button><button class="sta-action-primary" type="button" onclick="enviarRecordatorioDesdeSheet()">Enviar</button></div><div id="staPendingMsg" class="sta-sheet-message"></div>`,'history');
}
async function enviarRecordatorioDesdeSheet(){
  if(!esGestor()||!eventoActual)return;
  const msg=document.getElementById('staPendingMsg');
  if(!['abierto','confirmado'].includes(eventoActual.estado)){if(msg)msg.textContent='Esta encuesta ya no admite respuestas.';return}
  if(msg)msg.textContent='Enviando recordatorio…';
  const resultado=await enviarNotificacionEvento(eventoActual.id,'pendientes');
  if(msg)msg.textContent=resultado.ok?(resultado.enviados===0?'No hay dispositivos pendientes a los que avisar.':`✅ Recordatorio enviado a ${resultado.enviados} dispositivo(s).`):'❌ No se ha podido enviar el recordatorio.';
  if(resultado.ok){
    await cargarEstadosNotificaciones();
    if(esAdmin()){actualizarResumenUsuarios();renderGestionUsuarios()};
    setTimeout(async()=>{await cargarResumenCuerdasFecha(fechaGestorSeleccionada);cerrarStaSheet()},900);
  }
}

/* Sustituye el bloque grande de pendientes por el contador compacto integrado */
if(typeof actualizarPendientesViabilidad==='function'){
  actualizarPendientesViabilidad=function(total){
    staPendientesTotal=Number(total||0);
    const conteo=document.getElementById('conteoPendientesViabilidad');
    if(conteo)conteo.textContent=staPendientesTotal===1?'1 persona':`${staPendientesTotal} personas`;
  };
}


/* V13 · Exportación de participantes e histórico de asistencia real */
let staAsistenciaRealActual=[];
function staCuerdaNombre(id){return CUERDAS.find(c=>Number(c.id)===Number(id))?.nombre||'Sin cuerda'}
function staRespuestaTexto(v){return v==='si'?'Sí':v==='no'?'No':'Pendiente'}
function staAsistenciaTexto(v){return v===true?'Asistió':v===false?'No asistió':'Sin registrar'}
function staCsv(v){const t=String(v??'').replace(/"/g,'""');return '"'+t+'"'}
function staNombreArchivo(v){return String(v||'evento').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70)||'evento'}

async function obtenerControlAsistenciaFecha(){
  if(!esGestor()||!fechaGestorSeleccionada)return {data:[],error:new Error('Sin permisos')};
  return await supabaseClient.rpc('control_asistencia_fecha',{p_fecha_evento_id:Number(fechaGestorSeleccionada)});
}

function staRelacionTexto(respuesta,asistio){
  if(asistio==null)return 'Asistencia pendiente de registrar';
  if(respuesta==='si'&&asistio===true)return 'Confirmó y asistió';
  if(respuesta==='si'&&asistio===false)return 'Confirmó y no asistió';
  if(respuesta==='no'&&asistio===true)return 'No confirmó y asistió';
  if(respuesta==='no'&&asistio===false)return 'No confirmó y no asistió';
  if(asistio===true)return 'Sin respuesta previa y asistió';
  return 'Sin respuesta previa y no asistió';
}
async function staCrearXlsx(reporte){
 const {evento='',fecha='',hora='',lugar='',filas=[]}=reporte||{},wb=await staExcelNuevoLibro(),ws=wb.addWorksheet('Participantes',{properties:{tabColor:{argb:staExcelArgb(STA_XLSX.orange)}}});staExcelConfigHoja(ws);staExcelTitulo(ws,'SPIRIT TO ALL · CONTROL DE PARTICIPANTES','Disponibilidad y asistencia real','K');
 ws.getRow(4).values=['Evento',evento,'Fecha',staExcelFecha(fecha),'Hora',hora,'Lugar',lugar||'—'];
 ws.getRow(4).eachCell((c,col)=>{if([1,3,5,7].includes(col)){c.font={bold:true,color:{argb:staExcelArgb(STA_XLSX.white)}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.orange)}}}else{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.orangeSoft)}}}});if(ws.getCell('D4').value instanceof Date)ws.getCell('D4').numFmt='dd/mm/yyyy';
 const headers=['Nombre','Cuerda','Solista','Instrumento','Disponibilidad','Asistencia real','Relación','Evento','Fecha','Hora','Lugar'];const hr=ws.getRow(6);hr.values=headers;staExcelCabecera(hr);
 filas.forEach((p,i)=>{const r=ws.getRow(7+i);r.values=[p.nombre||'',staCuerdaNombre(p.cuerda_id),p.es_solista?'Sí':'No',p.instrumento?etiquetaInstrumento(p.instrumento):'',staRespuestaTexto(p.respuesta),staAsistenciaTexto(p.asistio),staRelacionTexto(p.respuesta,p.asistio),evento,staExcelFecha(fecha),hora,lugar];staExcelFila(r,i);if(r.getCell(9).value instanceof Date)r.getCell(9).numFmt='dd/mm/yyyy';if(p.respuesta==='si')r.getCell(5).fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.green)}};if(p.respuesta==='no')r.getCell(5).fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.red)}};if(p.asistio===true)r.getCell(6).fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.green)}};if(p.asistio===false)r.getCell(6).fill={type:'pattern',pattern:'solid',fgColor:{argb:staExcelArgb(STA_XLSX.red)}}});
 [30,17,11,20,18,18,31,28,14,11,24].forEach((w,i)=>ws.getColumn(i+1).width=w);ws.views=[{state:'frozen',ySplit:6,showGridLines:false}];ws.autoFilter={from:{row:6,column:1},to:{row:Math.max(6,6+filas.length),column:11}};
 return await staExcelBytes(wb)
}
async function exportarParticipantesFecha(){
  if(!esGestor()||!fechaGestorSeleccionada)return;
  const f=fechasEventoActual.find(x=>Number(x.id)===Number(fechaGestorSeleccionada));
  const {data,error}=await obtenerControlAsistenciaFecha();
  if(error){console.error(error);alert('No se puede exportar todavía. Revisa que la función de asistencia esté activa en Supabase.');return}
  const arr=data||[];
  try{
    const bytes=await staCrearXlsx({evento:eventoActual?.titulo||'',fecha:f?.fecha||'',hora:formatearHora(f?.hora)||'',lugar:f?.lugar||'',filas:arr});
    const blob=new Blob([bytes],{type:STA_XLSX_MIME});
    await staGuardarBlobCompatible(blob,`Spirit_to_All_${staNombreArchivo(eventoActual?.titulo)}_${f?.fecha||'fecha'}.xlsx`,{selectorArchivo:true});
  }catch(e){console.error(e);alert('No se ha podido generar el archivo Excel.');}
}

let staAsistenciaBorrador=new Map();
let staAsistenciaGuardada=new Map();
function staValorBorrador(uid){return staAsistenciaBorrador.has(String(uid))?staAsistenciaBorrador.get(String(uid)):null}
function staRelacionBadge(respuesta,asistio){
  const txt=staRelacionTexto(respuesta,asistio);
  const cls=asistio==null?'pending':(respuesta==='si'&&asistio===true)?'ok':((respuesta==='si'&&asistio===false)||(respuesta==='no'&&asistio===true))?'alert':'neutral';
  return `<span class="sta-relation-badge ${cls}">${escapeHtml(txt)}</span>`;
}
function seleccionarAsistenciaReal(usuarioId,valor){
  staAsistenciaBorrador.set(String(usuarioId),valor);
  const filtro=document.querySelector('.sta-attendance-search input')?.value||'';
  staRenderAsistenciaReal(filtro);
}
function staHayCambiosAsistencia(){
  for(const [uid,val] of staAsistenciaBorrador.entries())if(val!==staAsistenciaGuardada.get(uid))return true;
  return false;
}
function staRenderAsistenciaReal(filtro=''){
  const body=document.getElementById('staSheetBody');if(!body)return;
  const q=String(filtro||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const all=staAsistenciaRealActual||[];
  const arr=all.filter(p=>!q||[p.nombre,staCuerdaNombre(p.cuerda_id),p.instrumento].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));
  const valores=all.map(p=>staValorBorrador(p.usuario_id));
  const si=valores.filter(v=>v===true).length,no=valores.filter(v=>v===false).length,sin=valores.length-si-no;
  const rows=arr.map(p=>{
    const vote=p.respuesta==='si'?'✅ Dijo que sí':p.respuesta==='no'?'❌ Dijo que no':'⏳ Sin respuesta';
    const extra=[staCuerdaNombre(p.cuerda_id),p.es_solista?'Solista':'',p.instrumento?etiquetaInstrumento(p.instrumento):''].filter(Boolean).join(' · ');
    const uid=String(p.usuario_id),actual=staValorBorrador(uid);
    return `<div class="sta-attendance-person"><div class="sta-attendance-person-head"><div><strong>${escapeHtml(p.nombre||'Sin nombre')}</strong><small>${escapeHtml(extra)}</small></div><span class="sta-vote-badge">${vote}</span></div><div class="sta-relation-line"><span>Disponibilidad ↔ asistencia</span>${staRelacionBadge(p.respuesta,actual)}</div><div class="sta-attendance-choice two"><button class="${actual===true?'active-si':''}" onclick="seleccionarAsistenciaReal('${uid}',true)">✓ Asistió</button><button class="${actual===false?'active-no':''}" onclick="seleccionarAsistenciaReal('${uid}',false)">✕ No asistió</button></div>${actual==null?'<small class="sta-unregistered-note">Sin asistencia real registrada todavía.</small>':''}</div>`;
  }).join('');
  const cambios=staHayCambiosAsistencia();
  body.innerHTML=`<div class="sta-sheet-intro"><strong>Disponibilidad y asistencia real</strong><p>La disponibilidad indica lo que la persona respondió antes del evento. La asistencia real registra lo que ocurrió finalmente. Selecciona los cambios y pulsa Guardar asistencia.</p></div><div class="sta-attendance-summary"><div><strong>${si}</strong><small>Asistieron</small></div><div><strong>${no}</strong><small>No asistieron</small></div><div><strong>${sin}</strong><small>Sin registrar</small></div></div><div class="sta-attendance-search"><input type="search" placeholder="Buscar persona…" value="${escapeHtml(filtro)}" oninput="staRenderAsistenciaReal(this.value)"></div><div class="sta-attendance-list">${rows||'<div class="sta-sheet-intro"><strong>No hay personas que coincidan.</strong></div>'}</div><div class="sta-save-dock sta-attendance-save"><button class="sta-action-primary" type="button" onclick="guardarCambiosAsistenciaReal()" ${cambios?'':'disabled'}>${cambios?'Guardar asistencia':'Sin cambios pendientes'}</button><div id="staAttendanceMsg" class="sta-sheet-message"></div></div>`;
}
async function abrirAsistenciaRealFecha(){
  if(!esGestor()||!fechaGestorSeleccionada)return;
  abrirStaSheet('Asistencia real','<div class="sta-sheet-intro"><strong>Cargando personas…</strong></div>');
  const {data,error}=await obtenerControlAsistenciaFecha();
  if(error){console.error(error);document.getElementById('staSheetBody').innerHTML='<div class="sta-sheet-intro"><strong>Falta activar esta función en Supabase.</strong><p>Revisa la función de asistencia real en Supabase.</p></div>';return}
  staAsistenciaRealActual=(data||[]).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es',{sensitivity:'base'}));
  staAsistenciaGuardada=new Map(staAsistenciaRealActual.map(p=>[String(p.usuario_id),p.asistio==null?null:Boolean(p.asistio)]));
  staAsistenciaBorrador=new Map(staAsistenciaGuardada);
  staRenderAsistenciaReal();
}
async function guardarCambiosAsistenciaReal(){
  if(!esGestor()||!fechaGestorSeleccionada)return;
  const cambios=[];
  for(const [uid,val] of staAsistenciaBorrador.entries())if(val!==staAsistenciaGuardada.get(uid)&&val!==null)cambios.push([uid,val]);
  const msg=document.getElementById('staAttendanceMsg');
  if(!cambios.length){if(msg)msg.textContent='No hay cambios pendientes.';return}
  if(msg)msg.textContent=`Guardando ${cambios.length===1?'1 cambio':cambios.length+' cambios'}…`;
  for(const [uid,val] of cambios){
    const {error}=await supabaseClient.rpc('guardar_asistencia_real',{p_fecha_evento_id:Number(fechaGestorSeleccionada),p_usuario_id:uid,p_asistio:val});
    if(error){console.error(error);if(msg)msg.textContent='❌ No se han podido guardar todos los cambios.';return}
    staAsistenciaGuardada.set(uid,val);
    const p=staAsistenciaRealActual.find(x=>String(x.usuario_id)===uid);if(p)p.asistio=val;
  }
  const filtro=document.querySelector('.sta-attendance-search input')?.value||'';
  staRenderAsistenciaReal(filtro);
  const msgFinal=document.getElementById('staAttendanceMsg');
  if(msgFinal)msgFinal.textContent='✅ Asistencia guardada correctamente.';
}


// =========================================================
// PRODUCCIÓN INTEGRAL DEL EVENTO · seguimiento transversal
// =========================================================
const STA_PRODUCCION_AREAS=[
  {id:'marketing',icono:'📣',nombre:'Marketing y postureo',campo:'marketing_responsable',sub:'Cartel, logos, publicaciones y coordinación de difusión.'},
  {id:'comercial',icono:'💼',nombre:'Distribución comercial',campo:'comercial_responsable',sub:'Cliente, dossier, condiciones, presupuesto y seguimiento.'},
  {id:'creatividad',icono:'🎨',nombre:'Creatividad',campo:'creatividad_responsable',sub:'Vestuario, arreglos, textos y necesidades creativas.'},
  {id:'logistica',icono:'🚗',nombre:'Logística',campo:'logistica_responsable',sub:'Transporte, horarios, sonido, montaje y desmontaje.'},
  {id:'ministerio',icono:'🏛️',nombre:'Ministerio / Junta',campo:'ministerio_responsable',sub:'Decisiones y aprobaciones que requieran coordinación de junta.'}
];
const STA_PRODUCCION_PLANTILLAS={
  marketing:['Cartel / creatividad visual','Logos y materiales enviados','Publicación en redes y web','Coordinación de publicidad con el cliente'],
  comercial:['Dossier enviado','Condiciones y caché confirmados','Presupuesto revisado','Facturación / cobro revisado'],
  creatividad:['Vestuario definido','Texto / presentación del concierto'],
  logistica:['Coches / transporte organizados','Horarios y punto de encuentro confirmados','Técnico de sonido confirmado','Montaje organizado','Desmontaje organizado'],
  ministerio:['Decisiones económicas o aprobaciones necesarias revisadas']
};
let staProduccionEventoId=null,staProduccionFicha=null,staProduccionMinisterio=null,staProduccionTareas=[],staProduccionLogistica=null,staProduccionAreaActiva='marketing',staProduccionLogisticaTab='tecnica',staProduccionCreatividadTab='vestuario';
let staPermisosPropios=[],staAccesosActivados=true;
async function staCargarPermisosPropios(){
  const uid=usuarioActual?.id;
  staPermisosPropios=[];staAccesosActivados=true;
  if(!uid||!perfilActual?.aprobado||perfilActual?.eliminado||esAdmin())return;
  const [permisos,estado]=await Promise.all([
    supabaseClient.rpc('sta_mis_permisos'),supabaseClient.rpc('sta_accesos_activados')
  ]);
  if(usuarioActual?.id!==uid)return;
  if(!permisos.error)staPermisosPropios=Array.isArray(permisos.data)?permisos.data:[];
  if(!estado.error)staAccesosActivados=estado.data===true;
}
function staTienePermiso(permiso){
  const previo=esGestor()&&!staAccesosActivados&&['comercial','encuestas','contabilidad','viabilidad','informes','redes','logistica'].includes(permiso);
  return Boolean(esAdmin()||previo||staPermisosPropios.includes(permiso));
}
const staPermisosMenu={crm:'comercial',comercial:'comercial',gestionEncuestas:'encuestas',
  viabilidad:'viabilidad',dinero:'contabilidad',contabilidad:'contabilidad',informes:'informes',usuarios:'usuarios'};
function staActualizarMenuPermisos(){
  document.querySelectorAll('#homeGestion [onclick^="staInicioAbrir"]').forEach(b=>{
    const permiso=staPermisosMenu[b.getAttribute('onclick').split("'")[1]];
    if(permiso)b.classList.toggle('hidden',!staTienePermiso(permiso));
  });
}
function staGestionaArea(area){
  return esAdmin()||Boolean(esGestor()&&staEquipoResponsables
    .find(u=>u.id===String(usuarioActual?.id))?.areas.includes(area));
}
function staAreasProduccionVisibles(){return STA_PRODUCCION_AREAS.filter(a=>staGestionaArea(a.id))}
function staPuedeEditarAreaProduccion(areaId){return staGestionaArea(areaId)}

function staEventosProduccion(){
  const rank={confirmado:0,abierto:1,finalizado:2};
  return (eventosActuales||[]).filter(e=>!e.eliminado&&['confirmado','abierto','finalizado'].includes(e.estado)).slice().sort((a,b)=>{
    const ra=rank[a.estado]??9,rb=rank[b.estado]??9;if(ra!==rb)return ra-rb;
    if(a.estado==='finalizado')return String(b.fecha||'').localeCompare(String(a.fecha||''));
    return String(a.fecha||'9999-12-31').localeCompare(String(b.fecha||'9999-12-31'));
  });
}
function staProduccionEstadoEvento(e){return ({confirmado:'✅ Confirmado',abierto:'🟠 Abierto',finalizado:'📁 Finalizado'})[e?.estado]||String(e?.estado||'')}
function staProduccionEtiquetaEvento(e){
  return `${e?.titulo||'Evento'} · ${formatearFechaCorta(e?.fecha||'')} · ${staProduccionEstadoEvento(e)}`;
}
function staProduccionEventoSeleccionadoHtml(e){
  if(!e)return '';
  const lugar=e.lugar?` · 📍 ${escapeHtml(e.lugar)}`:'';
  return `<div class="sta-prod-selected-event"><div class="copy"><strong>${escapeHtml(e.titulo||'Evento')}</strong><small>${escapeHtml(formatearFechaCorta(e.fecha||''))}${lugar}</small></div><span class="status">${escapeHtml(staProduccionEstadoEvento(e))}</span></div>`;
}
function staProduccionSelectorHtml(eventos,id,contenido=''){
  const seleccionado=eventos.find(e=>Number(e.id)===Number(id))||eventos[0]||null;
  return `<div class="sta-prod-selectorbar"><div class="sta-prod-selector-intro"><div><small>🎬 Centro de producción</small><strong>Seguimiento integral por actuación</strong></div></div><div id="staProduccionSeleccionado">${staProduccionEventoSeleccionadoHtml(seleccionado)}</div><div class="sta-prod-search-wrap"><label class="control-label sta-prod-search-label">Buscar actuación<input id="staProduccionEventoBuscar" type="search" autocomplete="off" placeholder="Nombre, fecha, lugar o estado…" oninput="staFiltrarEventosProduccion(this.value,true)" onfocus="staFiltrarEventosProduccion(this.value,true)" onkeydown="if(event.key==='Escape'){staCerrarBuscadorProduccion()}"></label><span class="sta-prod-search-icon">🔎</span><div id="staProduccionResultados" class="sta-prod-search-results hidden"></div></div></div><div id="staProduccionContenido">${contenido}</div>`;
}
function staCerrarBuscadorProduccion(){
  document.getElementById('staProduccionResultados')?.classList.add('hidden');
}
function staFiltrarEventosProduccion(valor='',mostrarVacio=false){
  const box=document.getElementById('staProduccionResultados');if(!box)return;
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const q=norm(valor).trim();
  if(!q&&!mostrarVacio){box.innerHTML='';box.classList.add('hidden');return}
  const eventos=staEventosProduccion();
  const encontrados=eventos.filter(e=>{
    if(!q)return true;
    const texto=norm([e.titulo,e.fecha,formatearFechaCorta(e.fecha||''),e.lugar,staProduccionEstadoEvento(e),e.estado].join(' '));
    return texto.includes(q);
  }).slice(0,6);
  box.innerHTML=encontrados.length?encontrados.map(e=>`<button type="button" class="sta-prod-search-result" onclick="staSeleccionarEventoProduccion(${Number(e.id)})"><span><strong>${escapeHtml(e.titulo||'Evento')}</strong><small>${escapeHtml(formatearFechaCorta(e.fecha||''))}${e.lugar?' · '+escapeHtml(e.lugar):''}</small></span><span class="badge">${escapeHtml(staProduccionEstadoEvento(e))}</span></button>`).join(''):`<div class="sta-prod-search-empty">No encuentro ninguna actuación con ese criterio.</div>`;
  box.classList.remove('hidden');
}
function staActualizarEventoSeleccionadoProduccion(){
  const e=staEventosProduccion().find(x=>Number(x.id)===Number(staProduccionEventoId));
  const box=document.getElementById('staProduccionSeleccionado');if(box)box.innerHTML=staProduccionEventoSeleccionadoHtml(e);
}
function staSeleccionarEventoProduccion(id){
  const input=document.getElementById('staProduccionEventoBuscar');if(input)input.value='';
  staCerrarBuscadorProduccion();
  staCargarProduccionEvento(id);
}
async function abrirProduccionEventos(){
  if(!esGestor())return;
  if(!(eventosActuales||[]).length)await cargarTodo();
  const eventos=staEventosProduccion();
  if(!eventos.length){abrirStaSheet('Producción','<div class="sta-sheet-intro"><strong>No hay actuaciones disponibles.</strong><p>Cuando exista una encuesta abierta, confirmada o finalizada aparecerá aquí para organizar su producción.</p></div>');return}
  const hoy=staFechaMadrid();
  const elegido=eventos.find(e=>e.estado==='confirmado'&&String(e.fecha||'')>=hoy)||eventos.find(e=>e.estado==='confirmado')||eventos[0];
  abrirStaSheet('Producción',staProduccionSelectorHtml(eventos,elegido.id,'<div class="sta-sheet-intro"><strong>Cargando producción…</strong></div>'));
  await staCargarProduccionEvento(elegido.id);
}
async function staAsegurarPlantillaProduccion(eventoId,tareasActuales,fichaActual){
  // Gestor trabaja con las cuatro áreas operativas. Ministerio/Junta es exclusivo de admin.
  // La plantilla operativa se inicializa una sola vez por evento. Después, cualquier tarea
  // (incluidas las iniciales) puede eliminarse y no se recreará al volver a entrar.
  const existentes=tareasActuales||[],nuevas=[];
  const areasOperativas=STA_PRODUCCION_AREAS.filter(a=>a.id!=='ministerio');
  const operativaInicializada=!esAdmin()||Boolean(fichaActual?.plantilla_operativa_inicializada);
  if(!operativaInicializada){
    for(const area of areasOperativas){
      let orden=0;
      for(const titulo of (STA_PRODUCCION_PLANTILLAS[area.id]||[])){
        orden+=10;
        const yaExiste=existentes.some(t=>t.area===area.id&&String(t.titulo||'')===titulo);
        if(!yaExiste)nuevas.push({evento_id:Number(eventoId),area:area.id,titulo,orden,creado_por:usuarioActual?.id||null,actualizado_por:usuarioActual?.id||null});
      }
    }
  }
  if(esAdmin()){
    const hayMinisterio=existentes.some(t=>t.area==='ministerio');
    const inicializado=Boolean(staProduccionMinisterio?.plantilla_inicializada);
    if(!hayMinisterio&&!inicializado){let orden=0;for(const titulo of (STA_PRODUCCION_PLANTILLAS.ministerio||[])){orden+=10;nuevas.push({evento_id:Number(eventoId),area:'ministerio',titulo,orden,creado_por:usuarioActual?.id||null,actualizado_por:usuarioActual?.id||null})}}
    if(!inicializado){
      const payload={evento_id:Number(eventoId),responsable:staProduccionMinisterio?.responsable||null,plantilla_inicializada:true,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null};
      const r=await supabaseClient.from('produccion_ministerio').upsert(payload,{onConflict:'evento_id'}).select('*').single();if(r.error)throw r.error;staProduccionMinisterio=r.data;
    }
  }
  if(nuevas.length){const {error}=await supabaseClient.from('produccion_tareas').insert(nuevas);if(error)throw error}
  if(!operativaInicializada){
    const ahora=new Date().toISOString();
    const upd=await supabaseClient.from('produccion_eventos').update({plantilla_operativa_inicializada:true,actualizado_en:ahora,actualizado_por:usuarioActual?.id||null}).eq('evento_id',Number(eventoId)).select('*').single();
    if(upd.error)throw upd.error;
    if(fichaActual&&upd.data)Object.assign(fichaActual,upd.data);
  }
}
function staEsErrorJwtFuturo(error){
  const txt=String(error?.message||error||'').toLowerCase();
  return txt.includes('jwt issued at future')||txt.includes('jwt issued in the future')||txt.includes('issued at future');
}
function staEsperar(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function staDecodificarPayloadJwt(token){
  try{
    const parte=String(token||'').split('.')[1];if(!parte)return null;
    const normalizada=parte.replace(/-/g,'+').replace(/_/g,'/');
    const relleno='='.repeat((4-normalizada.length%4)%4);
    return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(normalizada+relleno),c=>'%' + ('00'+c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  }catch(_){return null}
}
async function staRepararSesionJwtProduccion(){
  // Algunos móviles pueden conservar durante unos segundos un JWT cuyo "iat" queda
  // ligeramente por delante del reloj que valida PostgREST. Esperamos el desfase y
  // renovamos la sesión una sola vez, sin cerrar al usuario ni perder su trabajo.
  let espera=1600;
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    const payload=staDecodificarPayloadJwt(session?.access_token);
    const desfase=Number(payload?.iat||0)*1000-Date.now();
    if(desfase>0)espera=Math.min(Math.max(desfase+1200,1600),8000);
  }catch(_){/* seguimos con una espera corta */}
  await staEsperar(espera);
  const {data,error}=await supabaseClient.auth.refreshSession();
  if(error)throw error;
  if(data?.user)usuarioActual=data.user;
  await staEsperar(700);
}
async function staCargarProduccionEvento(id,intentoSesion=0){
  if(!esGestor())return;
  const eventoId=Number(id);if(!eventoId)return;staProduccionEventoId=eventoId;staActualizarEventoSeleccionadoProduccion();
  const eventos=staEventosProduccion(),contenedor=document.getElementById('staSheetBody');
  if(contenedor)contenedor.innerHTML=staProduccionSelectorHtml(eventos,eventoId,'<div class="sta-sheet-intro"><strong>Cargando ficha…</strong><p>Reuniendo responsables, tareas y logística.</p></div>');
  try{
    await staCargarUsuariosParaTareas();
    await staEquipoCargar();
    let [{data:ficha,error:errorFicha},{data:tareas,error:errorTareas},{data:logistica,error:errorLog},{data:ministerio,error:errorMinisterio}]=await Promise.all([
      supabaseClient.from('produccion_eventos').select('*').eq('evento_id',eventoId).maybeSingle(),
      supabaseClient.from('produccion_tareas').select('*').eq('evento_id',eventoId).order('area').order('orden').order('id'),
      supabaseClient.from('produccion_logistica_publica').select('*').eq('evento_id',eventoId).maybeSingle(),
      esAdmin()?supabaseClient.from('produccion_ministerio').select('*').eq('evento_id',eventoId).maybeSingle():Promise.resolve({data:null,error:null})
    ]);
    if(errorFicha)throw errorFicha;if(errorTareas)throw errorTareas;if(errorLog)throw errorLog;if(errorMinisterio)throw errorMinisterio;
    staProduccionMinisterio=ministerio||null;
    if(!ficha){const ins=await supabaseClient.from('produccion_eventos').insert({evento_id:eventoId,actualizado_por:usuarioActual?.id||null}).select('*').single();if(ins.error)throw ins.error;ficha=ins.data}
    await staAsegurarPlantillaProduccion(eventoId,tareas||[],ficha);
    const recarga=await supabaseClient.from('produccion_tareas').select('*').eq('evento_id',eventoId).order('area').order('orden').order('id');if(recarga.error)throw recarga.error;
    staProduccionFicha=ficha||{};staProduccionTareas=recarga.data||[];staProduccionLogistica=logistica||null;
    staRenderProduccion();
  }catch(err){
    if(staEsErrorJwtFuturo(err)&&intentoSesion<1){
      console.warn('Producción: resincronizando sesión tras desfase temporal del JWT.');
      const box=document.getElementById('staProduccionContenido');
      if(box)box.innerHTML='<div class="sta-sheet-intro"><strong>🔄 Sincronizando la sesión…</strong><p>Un momento. La aplicación volverá a cargar Producción automáticamente.</p></div>';
      try{
        await staRepararSesionJwtProduccion();
        return await staCargarProduccionEvento(eventoId,intentoSesion+1);
      }catch(errorSesion){
        console.error('No se pudo resincronizar la sesión:',errorSesion);
        err=errorSesion;
      }
    }
    console.error('Error cargando producción:',err);
    const box=document.getElementById('staProduccionContenido');
    if(box){
      const msg=staEsErrorJwtFuturo(err)
        ?'La sesión no ha podido sincronizarse todavía. Comprueba que el móvil tenga activadas la fecha y hora automáticas y vuelve a abrir Producción.'
        :(err?.message||'Error desconocido');
      box.innerHTML=`<div class="sta-sheet-intro"><strong>❌ No se ha podido cargar Producción.</strong><p>${escapeHtml(msg)}</p><button class="btn-primary btn-full" type="button" onclick="staCargarProduccionEvento(${eventoId})">↻ Reintentar</button></div>`;
    }
  }
}
function staEstadoTareaLabel(v){return ({pendiente:'Pendiente',en_curso:'En curso',hecho:'Hecho',no_aplica:'No aplica'})[v]||v}
function staTaskMeta(t){const arr=[];if(t.responsable)arr.push(t.responsable);if(t.fecha_limite)arr.push('límite '+formatearFechaCorta(t.fecha_limite));return arr.join(' · ')}
function staHtmlTareaProduccion(t){
  const clase=t.estado==='hecho'?'done':t.estado==='en_curso'?'inprogress':t.estado==='no_aplica'?'na':'';
  return `<div class="sta-prod-task ${clase} sta-prod-task-redesign" data-task-id="${t.id}"><div class="sta-prod-task-head"><div><strong>${escapeHtml(t.titulo)}</strong><small>${escapeHtml(staTaskMeta(t)||'Sin responsable ni fecha límite')}</small></div><div class="sta-prod-task-controls"><select aria-label="Estado de ${escapeHtml(t.titulo)}" onchange="staCambiarEstadoTarea(${t.id},this.value)"><option value="pendiente" ${t.estado==='pendiente'?'selected':''}>Pendiente</option><option value="en_curso" ${t.estado==='en_curso'?'selected':''}>En curso</option><option value="hecho" ${t.estado==='hecho'?'selected':''}>Hecho</option><option value="no_aplica" ${t.estado==='no_aplica'?'selected':''}>No aplica</option></select></div></div><details class="sta-prod-task-details"><summary>✎ Responsable, fecha y detalles</summary><div class="sta-prod-task-edit"><label class="control-label">Responsable externo / equipo<input id="prodTaskResp-${t.id}" value="${escapeHtml(t.responsable||'')}" placeholder="Nombre o equipo"></label>${staTaskSelectorUsuario('prodTaskUsuario-'+t.id,t.responsable_usuario_id)}<label class="control-label">Fecha límite<input id="prodTaskFecha-${t.id}" type="date" value="${escapeHtml(t.fecha_limite||'')}"></label><label class="control-label full">Enlace<input id="prodTaskLink-${t.id}" type="url" inputmode="url" value="${escapeHtml(t.enlace||'')}" placeholder="https://..."></label><label class="control-label full">Notas<textarea id="prodTaskNotas-${t.id}" placeholder="Información útil para esta tarea">${escapeHtml(t.notas||'')}</textarea></label><div class="sta-prod-task-actions"><button class="btn-primary" type="button" onclick="staGuardarDetallesTarea(${t.id})">Guardar tarea</button><button class="sta-inline-action" type="button" onclick="staEliminarTareaProduccion(${t.id})">Eliminar tarea</button></div></div></details></div>`;
}
function staAreaResumen(area){
  const tareas=staProduccionTareas.filter(t=>t.area===area.id),aplicables=tareas.filter(t=>t.estado!=='no_aplica'),hechas=aplicables.filter(t=>t.estado==='hecho').length,total=aplicables.length;
  return {tareas,hechas,total,clase:total&&hechas===total?'done':hechas?'todo':'',texto:total?`${hechas}/${total}`:'—'};
}
function staProduccionNombreCorto(area){
  return ({marketing:'Marketing',comercial:'Comercial',creatividad:'Creatividad',logistica:'Logística',ministerio:'Junta'})[area.id]||area.nombre;
}
function staSeleccionarAreaProduccion(areaId){
  if(!staAreasProduccionVisibles().some(a=>a.id===areaId))return;
  staProduccionAreaActiva=areaId;
  if(areaId==='logistica'&&!['tareas','tecnica'].includes(staProduccionLogisticaTab))staProduccionLogisticaTab='tecnica';
  if(areaId==='creatividad'&&!['tareas','vestuario'].includes(staProduccionCreatividadTab))staProduccionCreatividadTab='vestuario';
  staRenderProduccion();
  requestAnimationFrame(()=>document.getElementById('staProdPanelActivo')?.scrollIntoView({behavior:'smooth',block:'nearest'}));
}
function staCambiarVistaLogistica(vista){
  if(!['tareas','tecnica'].includes(vista))return;
  staProduccionLogisticaTab=vista;staRenderProduccion();
}
function staCambiarVistaCreatividad(vista){
  if(!['tareas','vestuario'].includes(vista))return;
  staProduccionCreatividadTab=vista;staRenderProduccion();
}
function staHtmlNavProduccion(resumenes){
  return `<div class="sta-prod-area-nav">${resumenes.map(x=>{
    const pct=x.total?Math.round(x.hechas*100/x.total):0,active=x.a.id===staProduccionAreaActiva?' active':'';
    return `<button type="button" class="sta-prod-area-tab${active}" onclick="staSeleccionarAreaProduccion('${x.a.id}')" aria-pressed="${active?'true':'false'}"><span class="ico">${x.a.icono}</span><span class="name">${escapeHtml(staProduccionNombreCorto(x.a))}</span><span class="score">${x.total?`${x.hechas}/${x.total}`:'—'}</span><span class="sta-prod-mini-progress"><i style="width:${pct}%"></i></span></button>`;
  }).join('')}</div>`;
}
function staHtmlAreaProduccion(area){
  const r=staAreaResumen(area),resp=area.id==='ministerio'?(staProduccionMinisterio?.responsable||''):(staProduccionFicha?.[area.campo]||'');
  const tareas=`${r.tareas.map(staHtmlTareaProduccion).join('')||'<div class="sta-prod-empty-help">Todavía no hay tareas en esta área. Puedes crear la primera debajo.</div>'}<div class="sta-prod-add"><input id="prodNueva-${area.id}" maxlength="160" placeholder="Nueva tarea"><button class="btn-dark" type="button" onclick="staAgregarTareaProduccion('${area.id}')">＋ Añadir</button></div>`;
  const contenidoLogistica=area.id==='logistica'?`<div class="sta-prod-subtabs"><button type="button" class="sta-prod-subtab ${staProduccionLogisticaTab==='tecnica'?'active':''}" onclick="staCambiarVistaLogistica('tecnica')">🎛️ Técnica y montaje</button><button type="button" class="sta-prod-subtab ${staProduccionLogisticaTab==='tareas'?'active':''}" onclick="staCambiarVistaLogistica('tareas')">📋 Tareas <em>${r.texto}</em></button></div>${staProduccionLogisticaTab==='tecnica'?staHtmlLogisticaTecnica():tareas}`:null;
  const contenidoCreatividad=area.id==='creatividad'?`<div class="sta-prod-subtabs"><button type="button" class="sta-prod-subtab ${staProduccionCreatividadTab==='vestuario'?'active':''}" onclick="staCambiarVistaCreatividad('vestuario')">👗 Vestuario</button><button type="button" class="sta-prod-subtab ${staProduccionCreatividadTab==='tareas'?'active':''}" onclick="staCambiarVistaCreatividad('tareas')">📋 Tareas <em>${r.texto}</em></button></div>${staProduccionCreatividadTab==='vestuario'?staHtmlVestuarioCreatividad():tareas}`:null;
  const contenido=contenidoLogistica??contenidoCreatividad??tareas;
  return `<section id="staProdPanelActivo" class="sta-prod-active-panel"><div class="sta-prod-area-hero"><span class="ico">${area.icono}</span><span class="sta-prod-area-hero-copy"><strong>${escapeHtml(area.nombre)}</strong><small>${escapeHtml(area.sub)}</small></span><span class="sta-prod-count ${r.clase}">${r.texto}</span></div><div class="sta-prod-area-body"><details class="sta-area-coord sta-area-coord-event"><summary><span><small>Coordinación del área</small><strong>👤 ${escapeHtml(resp||'Sin asignar')}</strong></span><span class="sta-mini-edit">Cambiar ›</span></summary><div class="sta-area-coord-body"><label class="control-label">Responsable de ${escapeHtml(area.nombre)}${area.id==='ministerio'?`<input id="prodResp-${area.id}" value="${escapeHtml(resp)}" placeholder="Responsable de Junta">`:staCrmSelectorResponsable('prodResp-'+area.id,resp,area.id)}</label><button class="btn-primary" type="button" onclick="staGuardarResponsableArea('${area.id}')">Guardar coordinador</button></div></details>${contenido}</div></section>`;
}
function staHtmlVestuarioCreatividad(){
  const l=staProduccionLogistica||{},estado=l.vestuario_estado||'pendiente';
  const etiqueta=estado==='definido'?'✅ Definido':estado==='no_aplica'?'— No aplica':'⏳ Por definir';
  return `<div class="sta-prod-wardrobe"><div class="sta-prod-wardrobe-head"><div><h4>👗 Vestuario del evento</h4><p class="muted">Publica aquí qué hay que llevar, cantidades, quién lo transporta o cualquier indicación concreta.</p></div><span class="sta-prod-count ${estado==='definido'?'done':''}">${escapeHtml(etiqueta)}</span></div><div class="sta-prod-visible-note">👁️ Visible para miembros, gestores y administradores dentro de la actuación confirmada.</div><div class="sta-prod-wardrobe-grid"><label class="control-label">Estado del vestuario<select id="prodVestuarioEstado"><option value="pendiente" ${estado==='pendiente'?'selected':''}>⏳ Por definir</option><option value="definido" ${estado==='definido'?'selected':''}>✅ Definido</option><option value="no_aplica" ${estado==='no_aplica'?'selected':''}>— No aplica</option></select></label><label class="control-label">Indicaciones de vestuario<textarea id="prodVestuarioIndicaciones" placeholder="Escribe qué vestuario hay que llevar, cantidad, quién lo lleva o cualquier otra indicación.">${escapeHtml(l.vestuario_indicaciones||'')}</textarea></label></div><button class="btn-primary btn-full" type="button" onclick="staGuardarVestuarioPublico()">💾 Guardar vestuario</button><div id="staProdVestuarioMsg" class="muted" style="margin-top:6px;font-size:11px"></div></div>`;
}
function staHtmlLogisticaTecnica(){
  const l=staProduccionLogistica||{};
  const estado=l.tecnico_sonido_estado==='confirmado'?'✅ Confirmado':l.tecnico_sonido_estado==='no_necesario'?'— No necesario':'⏳ Por confirmar';
  return `<div class="sta-prod-tech"><div class="sta-prod-tech-head"><div><h4>🎛️ Sonido, montaje y desmontaje</h4><p class="muted">Operativa que también puede consultar el coro en la actuación confirmada.</p></div><span class="sta-prod-count ${l.tecnico_sonido_estado==='confirmado'?'done':''}">${escapeHtml(estado)}</span></div><div class="sta-prod-visible-note">👁️ Visible para miembros: técnico, montaje, desmontaje, horarios, acceso e indicaciones.</div><div class="sta-prod-tech-grid"><label class="control-label">Estado del técnico<select id="prodTecEstado"><option value="pendiente" ${(!l.tecnico_sonido_estado||l.tecnico_sonido_estado==='pendiente')?'selected':''}>⏳ Por confirmar</option><option value="confirmado" ${l.tecnico_sonido_estado==='confirmado'?'selected':''}>✅ Confirmado</option><option value="no_necesario" ${l.tecnico_sonido_estado==='no_necesario'?'selected':''}>— No se necesita</option></select></label><label class="control-label">Técnico/a que va<input id="prodTecNombre" value="${escapeHtml(l.tecnico_sonido_nombre||'')}" placeholder="Nombre"></label><label class="control-label full">Quién monta<input id="prodMontaje" value="${escapeHtml(l.montaje_responsables||'')}" placeholder="Una o varias personas"></label><label class="control-label full">Quién desmonta<input id="prodDesmontaje" value="${escapeHtml(l.desmontaje_responsables||'')}" placeholder="Una o varias personas"></label><label class="control-label">Hora montaje<input id="prodHoraMontaje" type="time" value="${escapeHtml(String(l.hora_montaje||'').slice(0,5))}"></label><label class="control-label">Hora desmontaje<input id="prodHoraDesmontaje" type="time" value="${escapeHtml(String(l.hora_desmontaje||'').slice(0,5))}"></label><label class="control-label full">Punto técnico / acceso<input id="prodPuntoTecnico" value="${escapeHtml(l.punto_tecnico||'')}" placeholder="Escenario, puerta de carga, punto de encuentro…"></label><label class="control-label full">Indicaciones para miembros<textarea id="prodNotasMiembros" placeholder="Lo que necesite saber el coro">${escapeHtml(l.notas_miembros||'')}</textarea></label></div><button class="btn-primary btn-full" type="button" onclick="staGuardarLogisticaTecnica()">💾 Guardar operativa técnica</button><div id="staProdTecMsg" class="muted" style="margin-top:6px;font-size:11px"></div></div>`;
}
function staRenderProduccion(){
  const box=document.getElementById('staProduccionContenido');if(!box)return;
  const e=(eventosActuales||[]).find(x=>Number(x.id)===Number(staProduccionEventoId));if(!e){box.innerHTML='<div class="sta-sheet-intro"><strong>Evento no encontrado.</strong></div>';return}
  const areasVisibles=staAreasProduccionVisibles();
  if(!areasVisibles.length){box.textContent='Aún no tienes áreas de Producción asignadas.';return}
  if(!areasVisibles.some(a=>a.id===staProduccionAreaActiva))staProduccionAreaActiva=areasVisibles[0]?.id||'marketing';
  const res=areasVisibles.map(a=>({a,...staAreaResumen(a)})),total=res.reduce((n,x)=>n+x.total,0),hechas=res.reduce((n,x)=>n+x.hechas,0),pct=total?Math.round(hechas*100/total):0;
  const area=areasVisibles.find(a=>a.id===staProduccionAreaActiva)||areasVisibles[0];
  box.innerHTML=`<div class="sta-prod-event-head"><div><span class="sta-prod-event-title">${escapeHtml(e.titulo||'Evento')}</span><span class="sta-prod-event-meta">${escapeHtml(formatearFechaCorta(e.fecha||''))}${e.lugar?' · 📍 '+escapeHtml(e.lugar):''} · ${escapeHtml(staProduccionEstadoEvento(e))}</span><span class="sta-prod-event-progress">${hechas}/${total} tareas completadas</span></div><div class="sta-prod-ring" style="--p:${pct}"><strong>${pct}%</strong></div></div>${staHtmlNavProduccion(res)}${staHtmlAreaProduccion(area)}`;
}
async function staGuardarResponsableArea(areaId){
  if(!staPuedeEditarAreaProduccion(areaId)||!staProduccionEventoId)return;const area=STA_PRODUCCION_AREAS.find(a=>a.id===areaId);if(!area)return;
  const valor=document.getElementById('prodResp-'+areaId)?.value.trim()||'',ahora=new Date().toISOString();
  if(areaId==='ministerio'){
    const payload={evento_id:Number(staProduccionEventoId),responsable:valor||null,plantilla_inicializada:Boolean(staProduccionMinisterio?.plantilla_inicializada),actualizado_en:ahora,actualizado_por:usuarioActual?.id||null};
    const {data,error}=await supabaseClient.from('produccion_ministerio').upsert(payload,{onConflict:'evento_id'}).select('*').single();if(error){console.error(error);alert('No se ha podido guardar el responsable de Ministerio/Junta.');return}
    staProduccionMinisterio=data;staRenderProduccion();return;
  }
  const patch={[area.campo]:valor||null,actualizado_en:ahora,actualizado_por:usuarioActual?.id||null};
  const {error}=await supabaseClient.from('produccion_eventos').update(patch).eq('evento_id',staProduccionEventoId);if(error){console.error(error);alert('No se ha podido guardar el responsable.');return}
  staProduccionFicha={...(staProduccionFicha||{}),...patch};staRenderProduccion();
}
async function staCambiarEstadoTarea(id,estado){
  const tarea=staProduccionTareas.find(x=>Number(x.id)===Number(id));if(!tarea||!staPuedeEditarAreaProduccion(tarea.area)||!['pendiente','en_curso','hecho','no_aplica'].includes(estado))return;
  const {error}=await supabaseClient.from('produccion_tareas').update({estado,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null}).eq('id',Number(id)).eq('evento_id',Number(staProduccionEventoId));
  if(error){console.error(error);alert('No se ha podido cambiar el estado de la tarea.');return}
  const t=staProduccionTareas.find(x=>Number(x.id)===Number(id));if(t)t.estado=estado;staRenderProduccion();
}
async function staGuardarDetallesTarea(id){
  const t=staProduccionTareas.find(x=>Number(x.id)===Number(id));if(!t||!staPuedeEditarAreaProduccion(t.area))return;
  const responsable=document.getElementById('prodTaskResp-'+id)?.value.trim()||'',fecha=document.getElementById('prodTaskFecha-'+id)?.value||null,enlace=document.getElementById('prodTaskLink-'+id)?.value.trim()||'',notas=document.getElementById('prodTaskNotas-'+id)?.value.trim()||'';
  if(enlace&&staUrlSegura(enlace)==='#'){alert('El enlace debe empezar por http:// o https://');return}
  const oldUser=t.responsable_usuario_id||null;const datos=staTaskResponsableDatos('prodTaskUsuario-'+id,'prodTaskResp-'+id);const patch={...datos,fecha_limite:fecha||null,enlace:enlace||null,notas:notas||null,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null};
  const {error}=await supabaseClient.from('produccion_tareas').update(patch).eq('id',Number(id)).eq('evento_id',Number(staProduccionEventoId));if(error){console.error(error);alert('No se ha podido guardar la tarea.');return}
  Object.assign(t,patch);staRenderProduccion();if(patch.responsable_usuario_id&&patch.responsable_usuario_id!==oldUser)void staTaskAvisarAsignacion('evento',id);
}
async function staAgregarTareaProduccion(areaId){
  if(!staPuedeEditarAreaProduccion(areaId)||!STA_PRODUCCION_AREAS.some(a=>a.id===areaId))return;const inp=document.getElementById('prodNueva-'+areaId),titulo=inp?.value.trim()||'';if(!titulo){inp?.focus();return}
  const orden=Math.max(0,...staProduccionTareas.filter(t=>t.area===areaId).map(t=>Number(t.orden||0)))+10;
  const {data,error}=await supabaseClient.from('produccion_tareas').insert({evento_id:Number(staProduccionEventoId),area:areaId,titulo,orden,creado_por:usuarioActual?.id||null,actualizado_por:usuarioActual?.id||null}).select('*').single();
  if(error){console.error(error);alert(error.code==='23505'?'Esa tarea ya existe en este área.':'No se ha podido añadir la tarea.');return}staProduccionTareas.push(data);staRenderProduccion();
}
async function staEliminarTareaProduccion(id){
  const t=staProduccionTareas.find(x=>Number(x.id)===Number(id));if(!t||!staPuedeEditarAreaProduccion(t.area)||!confirm(`¿Eliminar la tarea “${t.titulo}”?\n\nSe eliminará de este evento. Podrás crear otra cuando quieras.`))return;
  const {error}=await supabaseClient.from('produccion_tareas').delete().eq('id',Number(id)).eq('evento_id',Number(staProduccionEventoId));if(error){console.error(error);alert('No se ha podido eliminar la tarea.');return}
  staProduccionTareas=staProduccionTareas.filter(x=>Number(x.id)!==Number(id));staRenderProduccion();
}
async function staGuardarVestuarioPublico(){
  if(!esGestor()||!staProduccionEventoId)return;
  const estado=document.getElementById('prodVestuarioEstado')?.value||'pendiente';
  const indicaciones=document.getElementById('prodVestuarioIndicaciones')?.value.trim()||'';
  if(estado==='definido'&&!indicaciones){alert('Si el vestuario está definido, escribe las indicaciones que verá el coro.');document.getElementById('prodVestuarioIndicaciones')?.focus();return}
  const payload={evento_id:Number(staProduccionEventoId),vestuario_estado:estado,vestuario_indicaciones:indicaciones||null,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null};
  const {data,error}=await supabaseClient.from('produccion_logistica_publica').upsert(payload,{onConflict:'evento_id'}).select('*').single();
  const msg=document.getElementById('staProdVestuarioMsg');
  if(error){console.error(error);if(msg)msg.textContent='❌ No se ha podido guardar el vestuario.';return}
  staProduccionLogistica=data;staVestuarioPublicoCache.set(Number(staProduccionEventoId),data);
  if(msg)msg.textContent='✅ Guardado. El coro verá estas indicaciones en la actuación.';
}

async function staGuardarLogisticaTecnica(){
  if(!esGestor()||!staProduccionEventoId)return;
  const estado=document.getElementById('prodTecEstado')?.value||'pendiente',nombre=document.getElementById('prodTecNombre')?.value.trim()||'',montaje=document.getElementById('prodMontaje')?.value.trim()||'',desmontaje=document.getElementById('prodDesmontaje')?.value.trim()||'',horaMontaje=document.getElementById('prodHoraMontaje')?.value||null,horaDesmontaje=document.getElementById('prodHoraDesmontaje')?.value||null,punto=document.getElementById('prodPuntoTecnico')?.value.trim()||'',notas=document.getElementById('prodNotasMiembros')?.value.trim()||'';
  if(estado==='confirmado'&&!nombre){alert('Si el técnico está confirmado, indica quién va.');document.getElementById('prodTecNombre')?.focus();return}
  const payload={evento_id:Number(staProduccionEventoId),tecnico_sonido_estado:estado,tecnico_sonido_nombre:nombre||null,montaje_responsables:montaje||null,desmontaje_responsables:desmontaje||null,hora_montaje:horaMontaje||null,hora_desmontaje:horaDesmontaje||null,punto_tecnico:punto||null,notas_miembros:notas||null,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null};
  const {data,error}=await supabaseClient.from('produccion_logistica_publica').upsert(payload,{onConflict:'evento_id'}).select('*').single();if(error){console.error(error);const msg=document.getElementById('staProdTecMsg');if(msg)msg.textContent='❌ No se ha podido guardar.';return}
  staProduccionLogistica=data;const msg=document.getElementById('staProdTecMsg');if(msg)msg.textContent='✅ Guardado. Los miembros verán esta información en la actuación.';
}
function staHoraProduccion(v){const x=String(v||'');return x?x.slice(0,5):''}
function staEstadoTecnicoPublico(data){
  if(data?.tecnico_sonido_estado==='no_necesario')return{texto:'No necesario',clase:'na',detalle:'No se necesita técnico/a'};
  if(data?.tecnico_sonido_estado==='confirmado')return{texto:'Confirmado',clase:'ok',detalle:data?.tecnico_sonido_nombre||'Técnico confirmado'};
  return{texto:'Por confirmar',clase:'',detalle:data?.tecnico_sonido_nombre||'Técnico por confirmar'};
}
function staResumenInfoTecnica(data){
  const estado=staEstadoTecnicoPublico(data),partes=[estado.detalle];
  if(data?.montaje_responsables)partes.push('Montaje asignado');
  if(data?.desmontaje_responsables)partes.push('Desmontaje asignado');
  return partes.join(' · ');
}
function staEstadoVestuarioPublico(data){
  if(data?.vestuario_estado==='no_aplica')return{texto:'No aplica',clase:'na'};
  if(data?.vestuario_estado==='definido')return{texto:'Definido',clase:'ok'};
  return{texto:'Por definir',clase:''};
}
function staResumenVestuarioPublico(data){
  const texto=String(data?.vestuario_indicaciones||'').replace(/\s+/g,' ').trim();
  if(texto)return texto.length>80?texto.slice(0,77)+'…':texto;
  return data?.vestuario_estado==='no_aplica'?'No se requiere vestuario específico':'Indicaciones pendientes';
}
function staInfoVestuarioPantallaHtml(data,evento){
  const estado=staEstadoVestuarioPublico(data),titulo=escapeHtml(evento?.titulo||'Actuación'),fecha=evento?.fecha?formatearFechaCorta(evento.fecha):'';
  const contenido=data?.vestuario_estado==='no_aplica'?'No se requiere vestuario específico para esta actuación.':(data?.vestuario_indicaciones||'Aún no se han publicado indicaciones de vestuario.');
  return `<div class="sta-tech-screen-hero"><span class="ico">👗</span><div><strong>Vestuario</strong><small>${titulo}${fecha?' · '+escapeHtml(fecha):''}</small></div></div><div class="sta-tech-section-label">Estado</div><div class="sta-tech-ios-group"><div class="sta-tech-ios-row"><span class="ico">👗</span><span class="copy"><small>Vestuario del evento</small><strong>${escapeHtml(estado.texto)}</strong><em class="${estado.clase}">${escapeHtml(estado.texto)}</em></span></div></div><div class="sta-tech-section-label">Indicaciones</div><div class="sta-tech-note"><small>Qué hay que llevar</small><strong>${escapeHtml(contenido)}</strong></div>`;
}
async function abrirInfoVestuarioEvento(eventoId){
  const id=Number(eventoId||eventoActual?.id);if(!id)return;
  let data=staVestuarioPublicoCache.get(id)||null;
  if(!data){
    abrirStaSheet('Vestuario','<div class="sta-sheet-intro"><strong>Cargando vestuario…</strong><p>Un momento.</p></div>','event-detail');
    const r=await supabaseClient.from('produccion_logistica_publica').select('vestuario_estado,vestuario_indicaciones').eq('evento_id',id).maybeSingle();
    if(r.error){console.warn('No se pudo cargar vestuario público:',r.error);document.getElementById('staSheetBody').innerHTML='<div class="sta-sheet-intro"><strong>No se ha podido cargar.</strong><p>Vuelve a intentarlo en unos segundos.</p></div>';return}
    data=r.data||null;if(data)staVestuarioPublicoCache.set(id,data);
  }
  const evento=(eventosActuales||[]).find(x=>Number(x.id)===id)||eventoActual,body=document.getElementById('staSheetBody');
  if(!data){if(body)body.innerHTML='<div class="sta-sheet-intro"><strong>Aún no hay vestuario publicado.</strong><p>Cuando Creatividad lo defina aparecerá aquí.</p></div>';return}
  const html=staInfoVestuarioPantallaHtml(data,evento);
  if(document.getElementById('staSheetBackdrop')?.classList.contains('hidden'))abrirStaSheet('Vestuario',html,'event-detail');else{document.getElementById('staSheetTitle').textContent='Vestuario';if(body)body.innerHTML=html;const b=document.getElementById('staSheetBack');if(b){b.classList.remove('hidden');b.dataset.action='event-detail'}}
}
async function cargarInfoVestuarioEvento(eventoId){
  const box=document.getElementById('infoVestuarioEvento');if(!box)return;
  box.classList.add('hidden');box.innerHTML='';
  const e=(eventosActuales||[]).find(x=>Number(x.id)===Number(eventoId));
  if(!e||e.eliminado||e.estado!=='confirmado')return;
  const id=Number(eventoId);
  const pintar=(data)=>{
    if(Number(eventoActual?.id)!==id)return;
    const estado=staEstadoVestuarioPublico(data);
    const texto=data?estado.texto:'Pendiente de publicar';
    box.innerHTML=`<button type="button" class="sta-wardrobe-disclosure" onclick="abrirInfoVestuarioEvento(${id})" aria-label="Consultar vestuario"><span class="sta-wardrobe-disclosure-icon">👗</span><span class="sta-wardrobe-disclosure-copy"><strong>Vestuario</strong><small>${escapeHtml(texto)}${data?.vestuario_indicaciones?' · '+escapeHtml(staResumenVestuarioPublico(data)):''}</small></span><span class="sta-wardrobe-disclosure-chevron">›</span></button>`;
    box.classList.remove('hidden');
  };
  pintar(staVestuarioPublicoCache.get(id)||null);
  try{
    const {data,error}=await supabaseClient.from('produccion_logistica_publica').select('vestuario_estado,vestuario_indicaciones').eq('evento_id',id).maybeSingle();
    if(error)throw error;
    if(data)staVestuarioPublicoCache.set(id,data);
    pintar(data||null);
  }catch(error){console.warn('Vestuario no disponible:',error);pintar(null);}
}

function staInfoTecnicaPantallaHtml(data,evento){
  const estado=staEstadoTecnicoPublico(data);
  const titulo=escapeHtml(evento?.titulo||'Actuación');
  const fecha=evento?.fecha?formatearFechaCorta(evento.fecha):'';
  const fila=(icono,etiqueta,valor,extra='')=>`<div class="sta-tech-ios-row"><span class="ico">${icono}</span><span class="copy"><small>${escapeHtml(etiqueta)}</small><strong>${escapeHtml(valor||'Por confirmar')}</strong>${extra}</span></div>`;
  return `<div class="sta-tech-screen-hero"><span class="ico">🎛️</span><div><strong>Sonido y montaje</strong><small>${titulo}${fecha?' · '+escapeHtml(fecha):''}</small></div></div>
    <div class="sta-tech-section-label">Sonido</div><div class="sta-tech-ios-group">${fila('🎚️','Técnico/a de sonido',estado.detalle,`<em class="${estado.clase}">${escapeHtml(estado.texto)}</em>`)}</div>
    <div class="sta-tech-section-label">Montaje</div><div class="sta-tech-ios-group">${fila('🔧','Quién monta',data?.montaje_responsables||'Por confirmar')}${fila('🕐','Hora de montaje',data?.hora_montaje?staHoraProduccion(data.hora_montaje):'Por confirmar')}</div>
    <div class="sta-tech-section-label">Desmontaje</div><div class="sta-tech-ios-group">${fila('📦','Quién desmonta',data?.desmontaje_responsables||'Por confirmar')}${fila('🕐','Hora de desmontaje',data?.hora_desmontaje?staHoraProduccion(data.hora_desmontaje):'Por confirmar')}</div>
    ${data?.punto_tecnico?`<div class="sta-tech-section-label">Acceso</div><div class="sta-tech-ios-group">${fila('📍','Punto técnico / acceso',data.punto_tecnico)}</div>`:''}
    ${data?.notas_miembros?`<div class="sta-tech-note"><small>Indicaciones para el coro</small><strong>${escapeHtml(data.notas_miembros)}</strong></div>`:''}`;
}
async function abrirInfoTecnicaEvento(eventoId){
  const id=Number(eventoId||eventoActual?.id);if(!id)return;
  let data=staInfoTecnicaPublicaCache.get(id)||null;
  if(!data){
    abrirStaSheet('Información técnica','<div class="sta-sheet-intro"><strong>Cargando operativa técnica…</strong><p>Un momento.</p></div>','event-detail');
    const r=await supabaseClient.from('produccion_logistica_publica').select('tecnico_sonido_nombre,tecnico_sonido_estado,montaje_responsables,desmontaje_responsables,hora_montaje,hora_desmontaje,punto_tecnico,notas_miembros').eq('evento_id',id).maybeSingle();
    if(r.error){console.warn('No se pudo cargar logística pública:',r.error);document.getElementById('staSheetBody').innerHTML='<div class="sta-sheet-intro"><strong>No se ha podido cargar.</strong><p>Vuelve a intentarlo en unos segundos.</p></div>';return}
    data=r.data||null;if(data)staInfoTecnicaPublicaCache.set(id,data);
  }
  const evento=(eventosActuales||[]).find(x=>Number(x.id)===id)||eventoActual;
  const body=document.getElementById('staSheetBody');
  if(!data){if(body)body.innerHTML='<div class="sta-sheet-intro"><strong>Aún no hay información técnica publicada.</strong><p>Cuando gestión confirme sonido, montaje o desmontaje aparecerá aquí.</p></div>';return}
  const html=staInfoTecnicaPantallaHtml(data,evento);
  if(document.getElementById('staSheetBackdrop')?.classList.contains('hidden'))abrirStaSheet('Información técnica',html,'event-detail');else{document.getElementById('staSheetTitle').textContent='Información técnica';if(body)body.innerHTML=html;const b=document.getElementById('staSheetBack');if(b){b.classList.remove('hidden');b.dataset.action='event-detail'}}
}
async function cargarInfoTecnicaEvento(eventoId){
  const box=document.getElementById('infoTecnicaEvento');if(!box)return;
  box.classList.add('hidden');box.innerHTML='';
  const e=(eventosActuales||[]).find(x=>Number(x.id)===Number(eventoId));
  if(!e||e.eliminado||e.estado!=='confirmado')return;
  const id=Number(eventoId);
  const pintar=(data)=>{
    if(Number(eventoActual?.id)!==id)return;
    const estado=staEstadoTecnicoPublico(data);
    const texto=data?estado.texto:'Pendiente de publicar';
    box.innerHTML=`<button type="button" class="sta-tech-disclosure" onclick="abrirInfoTecnicaEvento(${id})" aria-label="Consultar sonido y montaje"><span class="sta-tech-disclosure-icon">🎛️</span><span class="sta-tech-disclosure-copy"><strong>Sonido y montaje</strong><small>${escapeHtml(texto)}${data&&staResumenInfoTecnica(data)?' · '+escapeHtml(staResumenInfoTecnica(data)):''}</small></span><span class="sta-tech-disclosure-chevron">›</span></button>`;
    box.classList.remove('hidden');
  };
  pintar(staInfoTecnicaPublicaCache.get(id)||null);
  try{
    const {data,error}=await supabaseClient.from('produccion_logistica_publica').select('tecnico_sonido_nombre,tecnico_sonido_estado,montaje_responsables,desmontaje_responsables,hora_montaje,hora_desmontaje,punto_tecnico,notas_miembros').eq('evento_id',id).maybeSingle();
    if(error)throw error;
    if(data)staInfoTecnicaPublicaCache.set(id,data);
    pintar(data||null);
  }catch(error){console.warn('Sonido y montaje no disponible:',error);pintar(null);}
}

