// =========================================================
// SEGURIDAD + CONTABILIDAD · 2026-10-09
// =========================================================
let staEmisorSeguroCache=null;
let staContabilidadCache=[];
let staContabilidadCargando=false;

const STA_SECURITY_NOTICE_KEY='sta_security_notice_20261009_seen';
function abrirAvisoSeguridad(auto=false){
  const m=document.getElementById('modalSeguridad');if(!m)return;
  m.classList.remove('hidden');document.body.style.overflow='hidden';
}
function cerrarAvisoSeguridad(recordar=false){
  document.getElementById('modalSeguridad')?.classList.add('hidden');
  if(recordar){try{localStorage.setItem(STA_SECURITY_NOTICE_KEY,'1')}catch(_){}}
  if(!document.querySelector('.tool-screen:not(.hidden)')&&!document.body.classList.contains('sta-sheet-open'))document.body.style.overflow='';
}
window.addEventListener('load',()=>{
  try{if(!localStorage.getItem(STA_SECURITY_NOTICE_KEY))setTimeout(()=>abrirAvisoSeguridad(true),650)}catch(_){setTimeout(()=>abrirAvisoSeguridad(true),650)}
});

// Datos fiscales del emisor: ya no quedan como fuente persistente en localStorage.
function staDatosEmisor(){return staEmisorSeguroCache||{nombre:'Spirit to All',cif:'',direccion:''}}
async function guardarDatosEmisor(d){
  if(!esGestor())return false;
  const payload=d||{};
  const {error}=await supabaseClient.rpc('guardar_configuracion_financiera',{p_nombre:payload.nombre||'Spirit to All',p_cif:payload.cif||'',p_direccion:payload.direccion||''});
  if(error){console.error(error);return false}
  staEmisorSeguroCache={nombre:payload.nombre||'Spirit to All',cif:payload.cif||'',direccion:payload.direccion||''};
  try{localStorage.removeItem('sta_facturacion_emisor')}catch(_){ }
  return true;
}
async function cargarDatosEmisorSeguro(){
  if(!esGestor())return staDatosEmisor();
  const {data,error}=await supabaseClient.rpc('obtener_configuracion_financiera');
  if(error){console.error(error);return staDatosEmisor()}
  const row=Array.isArray(data)?data[0]:data;
  if(row){staEmisorSeguroCache={nombre:row.nombre||'Spirit to All',cif:row.cif||'',direccion:row.direccion||''};try{localStorage.removeItem('sta_facturacion_emisor')}catch(_){}}
  else{
    try{
      const legacy=JSON.parse(localStorage.getItem('sta_facturacion_emisor')||'{}');
      if(legacy&&(legacy.cif||legacy.direccion||legacy.nombre)){await guardarDatosEmisor(legacy)}
    }catch(_){ }
  }
  return staDatosEmisor();
}
async function cargarDatosEmisorForm(){
  const d=await cargarDatosEmisorSeguro();
  if(document.getElementById('facturaEmisorNombre'))document.getElementById('facturaEmisorNombre').value=d.nombre||'Spirit to All';
  if(document.getElementById('facturaEmisorCif'))document.getElementById('facturaEmisorCif').value=d.cif||'';
  if(document.getElementById('facturaEmisorDireccion'))document.getElementById('facturaEmisorDireccion').value=d.direccion||'';
}
async function guardarDatosEmisorDesdeForm(){
  const m=document.getElementById('facturaMensaje');if(m)m.textContent='Guardando de forma segura…';
  const ok=await guardarDatosEmisor(datosEmisorForm());
  if(m)m.textContent=ok?'✅ Datos de la asociación guardados cifrados en Supabase.':'❌ No se han podido guardar los datos fiscales.';
}

function cambiarDineroVista(vista){
  const presupuestos=vista==='presupuestos',facturas=vista==='facturas',contabilidad=vista==='contabilidad';
  document.getElementById('moneyPresupuestos')?.classList.toggle('hidden',!presupuestos);
  document.getElementById('moneyFacturas')?.classList.toggle('hidden',!facturas);
  document.getElementById('moneyContabilidad')?.classList.toggle('hidden',!contabilidad);
  document.getElementById('moneyTabPresupuestos')?.classList.toggle('active',presupuestos);
  document.getElementById('moneyTabFacturas')?.classList.toggle('active',facturas);
  document.getElementById('moneyTabContabilidad')?.classList.toggle('active',contabilidad);
  if(facturas){cargarDatosEmisorSeguro();cargarFacturas()}else if(contabilidad)cargarContabilidad();else cargarSelectorPresupuestos();
}

function staContaAreaLabel(area){return({general:'General',marketing:'Marketing',comercial:'Comercial',creatividad:'Creatividad',logistica:'Logística',ministerio:'Ministerio / Junta'})[area]||area||'General'}
function staContaEventoLabel(id){const e=(eventosActuales||[]).find(x=>Number(x.id)===Number(id));return e?`${e.titulo||'Evento'} · ${formatearFechaCorta(e.fecha||'')}`:'Sin evento'}
function staContaEuros(n){return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(n||0))}
function staContaAreasDisponibles(){const arr=['general','marketing','comercial','creatividad','logistica'];if(esAdmin())arr.push('ministerio');return arr}
function staContaAreaOptions(actual='general'){return staContaAreasDisponibles().map(a=>`<option value="${a}" ${a===actual?'selected':''}>${escapeHtml(staContaAreaLabel(a))}</option>`).join('')}
function staContaEventoActivo(e){return !e.eliminado&&!['cancelado','descartado','eliminado'].includes(String(e.estado||'').toLowerCase())}
function staContaEventoOptions(actual=null){return `<option value="">Sin evento / gasto general</option>`+(eventosActuales||[]).filter(e=>staContaEventoActivo(e)||Number(actual)===Number(e.id)).slice().sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).map(e=>`<option value="${Number(e.id)}" ${Number(actual)===Number(e.id)?'selected':''}>${escapeHtml(staContaEventoLabel(e.id))}${staContaEventoActivo(e)?'':' · Cancelado (histórico)'}</option>`).join('')}
function staContaCategoriaOptions(actual='Otros'){const cats=['Ingreso actuación','Material','Sonido / técnica','Vestuario','Marketing / publicidad','Transporte','Desplazamiento','Alojamiento','Comidas','Honorarios','Donación / otros','Otros'];return cats.map(c=>`<option value="${escapeHtml(c)}" ${c===actual?'selected':''}>${escapeHtml(c)}</option>`).join('')}
function staContaEstadoOptions(actual='registrado'){const est={registrado:'Registrado',pendiente:'Pendiente',pagado:'Pagado',cobrado:'Cobrado',anulado:'Anulado'};return Object.entries(est).map(([k,v])=>`<option value="${k}" ${k===actual?'selected':''}>${v}</option>`).join('')}

async function cargarContabilidad(){
  if(!esGestor()||staContabilidadCargando)return;staContabilidadCargando=true;
  const box=document.getElementById('contaLista');if(box)box.innerHTML='<div class="sta-empty-state">Cargando contabilidad…</div>';
  try{
    const {data,error}=await supabaseClient.rpc('listar_movimientos_contables',{p_anio:null,p_evento_id:null,p_area:null,p_tipo:null});
    if(error)throw error;staContabilidadCache=data||[];
    staPrepararFiltrosContabilidad();pintarContabilidad();
  }catch(e){console.error(e);if(box)box.innerHTML='<div class="finance-note"><strong>No se ha podido cargar Contabilidad.</strong><br>Vuelve a intentarlo o comprueba tu sesión.</div>'}
  finally{staContabilidadCargando=false}
}
function staPrepararFiltrosContabilidad(){
  const yearSel=document.getElementById('contaFiltroAnio'),eventSel=document.getElementById('contaFiltroEvento'),areaSel=document.getElementById('contaFiltroArea');
  if(yearSel){const previo=yearSel.value,now=new Date().getFullYear(),yrs=new Set([now]);staContabilidadCache.forEach(m=>m.fecha&&yrs.add(Number(String(m.fecha).slice(0,4))));(eventosActuales||[]).forEach(e=>e.fecha&&yrs.add(Number(String(e.fecha).slice(0,4))));const arr=[...yrs].filter(Boolean).sort((a,b)=>b-a);yearSel.innerHTML=arr.map(y=>`<option value="${y}" ${String(y)===(previo||String(now))?'selected':''}>${y}</option>`).join('')}
  if(eventSel){const previo=eventSel.value;eventSel.innerHTML='<option value="">Todos</option>'+(eventosActuales||[]).filter(e=>!e.eliminado).slice().sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).map(e=>`<option value="${Number(e.id)}">${escapeHtml(staContaEventoLabel(e.id))}</option>`).join('');eventSel.value=previo}
  if(areaSel&&!esAdmin())areaSel.querySelector('option[value="ministerio"]')?.remove();
}
function staContabilidadFiltrada(){
  const y=Number(document.getElementById('contaFiltroAnio')?.value||new Date().getFullYear()),area=document.getElementById('contaFiltroArea')?.value||'',tipo=document.getElementById('contaFiltroTipo')?.value||'',evt=Number(document.getElementById('contaFiltroEvento')?.value||0),q=staNormalizarBusqueda(document.getElementById('contaBuscar')?.value||''),soloSinJustificante=document.getElementById('contaSoloSinJustificante')?.checked;
  return staContabilidadCache.filter(m=>(!soloSinJustificante||(m.estado!=='anulado'&&!staDocumentosContablesCache.some(d=>Number(d.movimiento_id)===Number(m.id)&&d.estado==='activo')))&&Number(String(m.fecha||'').slice(0,4))===y&&(!area||m.area===area)&&(!tipo||m.tipo===tipo)&&(!evt||Number(m.evento_id)===evt)&&(!q||staNormalizarBusqueda(`${m.concepto||''} ${m.tercero||''} ${m.nif||''} ${m.categoria||''} ${staContaAreaLabel(m.area)} ${staContaEventoLabel(m.evento_id)}`).includes(q)));
}
function pintarContabilidad(){
  if(!document.getElementById('moneyContabilidad'))return;
  const rows=staContabilidadFiltrada(),ing=rows.filter(x=>x.tipo==='ingreso'&&x.estado!=='anulado').reduce((a,x)=>a+Number(x.importe||0),0),gas=rows.filter(x=>x.tipo==='gasto'&&x.estado!=='anulado').reduce((a,x)=>a+Number(x.importe||0),0);
  if(document.getElementById('contaIngresos'))document.getElementById('contaIngresos').textContent=staContaEuros(ing);
  if(document.getElementById('contaGastos'))document.getElementById('contaGastos').textContent=staContaEuros(gas);
  if(document.getElementById('contaBalance'))document.getElementById('contaBalance').textContent=staContaEuros(ing-gas);
  const lista=document.getElementById('contaLista');
  if(lista)lista.innerHTML=rows.length?rows.map(m=>{const esIng=m.tipo==='ingreso',evt=m.evento_id?staContaEventoLabel(m.evento_id):'Sin evento',adj=m.tiene_adjunto?' · 📎':'';return `<button class="conta-item ${esIng?'ingreso':'gasto'}" type="button" onclick="abrirMovimientoContable(${Number(m.id)})"><span class="ico">${esIng?'↗️':'↘️'}</span><span><strong>${escapeHtml(m.concepto||'Movimiento')}</strong><small>✏️ Toca para editar · ${escapeHtml(formatearFechaCorta(m.fecha||''))} · ${escapeHtml(staContaAreaLabel(m.area))} · ${escapeHtml(evt)}${adj}</small></span><span class="amount">${esIng?'+':'−'} ${escapeHtml(staContaEuros(m.importe))}<small>${escapeHtml(m.estado||'')}</small></span></button>`}).join(''):'<div class="conta-empty">No hay movimientos con estos filtros.</div>';
  staPintarResumenContabilidad();
}
function staResumenRows(rows,keyFn){const map=new Map();for(const m of rows){if(m.estado==='anulado')continue;const k=keyFn(m),o=map.get(k)||{ing:0,gas:0};if(m.tipo==='ingreso')o.ing+=Number(m.importe||0);else o.gas+=Number(m.importe||0);map.set(k,o)}return map}
function staPintarResumenContabilidad(){
  const y=Number(document.getElementById('contaFiltroAnio')?.value||new Date().getFullYear()),base=staContabilidadCache.filter(m=>Number(String(m.fecha||'').slice(0,4))===y);
  const areas=staResumenRows(base,m=>m.area||'general'),aBox=document.getElementById('contaResumenAreas');if(aBox)aBox.innerHTML=[...areas.entries()].map(([k,v])=>`<div class="conta-summary-card"><strong>${escapeHtml(staContaAreaLabel(k))}</strong><small>+ ${escapeHtml(staContaEuros(v.ing))} · − ${escapeHtml(staContaEuros(v.gas))}<br>Balance ${escapeHtml(staContaEuros(v.ing-v.gas))}</small></div>`).join('')||'<div class="muted">Sin movimientos.</div>';
  const evs=staResumenRows(base,m=>m.evento_id?String(m.evento_id):'general'),eBox=document.getElementById('contaResumenEventos');if(eBox)eBox.innerHTML=[...evs.entries()].map(([k,v])=>`<div class="conta-summary-line"><span>${escapeHtml(k==='general'?'Sin evento / general':staContaEventoLabel(Number(k)))}</span><small>Ingresos ${escapeHtml(staContaEuros(v.ing))} · Gastos ${escapeHtml(staContaEuros(v.gas))} · <strong>${escapeHtml(staContaEuros(v.ing-v.gas))}</strong></small></div>`).join('')||'<div class="muted">Sin movimientos.</div>';
}
function abrirMovimientoContable(id=null,tipo='gasto',area='general',eventoId=null){
  if(!esGestor())return;const m=id?staContabilidadCache.find(x=>Number(x.id)===Number(id)):null;if(id&&!m)return;
  const v=m||{id:null,fecha:staFechaMadrid(),tipo,area,evento_id:eventoId,categoria:tipo==='ingreso'?'Ingreso actuación':'Otros',estado:tipo==='ingreso'?'cobrado':'pagado',concepto:'',tercero:'',nif:'',importe:'',notas:'',tiene_adjunto:false,adjunto_nombre:''};
  const html=`<div class="sta-sheet-intro"><strong>${v.id?'Editar movimiento':'Nuevo '+(v.tipo==='ingreso'?'ingreso':'gasto')}</strong><p>Los campos económicos, datos de tercero y justificante se guardan cifrados.</p></div><div class="conta-sheet-grid"><input id="contaMovId" type="hidden" value="${v.id||''}"><label class="control-label">Tipo<select id="contaMovTipo"><option value="gasto" ${v.tipo==='gasto'?'selected':''}>Gasto</option><option value="ingreso" ${v.tipo==='ingreso'?'selected':''}>Ingreso</option></select></label><label class="control-label">Fecha<input id="contaMovFecha" type="date" value="${escapeHtml(v.fecha||'')}"></label><label class="control-label">Área<select id="contaMovArea">${staContaAreaOptions(v.area||'general')}</select></label><label class="control-label">Estado<select id="contaMovEstado">${staContaEstadoOptions(v.estado||'registrado')}</select></label><label class="control-label full">Evento relacionado<select id="contaMovEvento">${staContaEventoOptions(v.evento_id)}</select></label><label class="control-label">Categoría<select id="contaMovCategoria">${staContaCategoriaOptions(v.categoria||'Otros')}</select></label><label class="control-label">Importe (€)<input id="contaMovImporte" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(v.importe??'')}"></label><label class="control-label full">Concepto<input id="contaMovConcepto" maxlength="220" value="${escapeHtml(v.concepto||'')}" placeholder="Ej.: compra de cables, caché actuación…"></label><label class="control-label">Tercero / proveedor / cliente<input id="contaMovTercero" value="${escapeHtml(v.tercero||'')}" placeholder="Opcional"></label><label class="control-label">NIF / CIF<input id="contaMovNif" value="${escapeHtml(v.nif||'')}" placeholder="Opcional"></label><label class="control-label full">Notas<textarea id="contaMovNotas" rows="3" placeholder="Forma de pago, referencia, detalle…">${escapeHtml(v.notas||'')}</textarea></label><label class="control-label full">Justificante (opcional, máx. 5 MB)<input id="contaMovAdjunto" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label></div>${v.tiene_adjunto?`<div class="conta-attachment-current"><span>📎 ${escapeHtml(v.adjunto_nombre||'Justificante adjunto')}</span><button class="btn-light btn-mini" type="button" onclick="descargarAdjuntoContable(${Number(v.id)})">Abrir</button></div><label class="sta-report-check"><input id="contaMovEliminarAdjunto" type="checkbox"><span><strong>Eliminar justificante actual</strong><small>Se quitará al guardar.</small></span></label>`:''}<div id="contaMovMsg" class="muted" style="margin-top:8px"></div><div class="conta-sheet-actions"><button class="btn-primary wide" type="button" onclick="guardarMovimientoContable()">💾 Guardar movimiento</button>${v.id?`<button class="btn-light" type="button" onclick="descargarAdjuntoContable(${Number(v.id)})" ${v.tiene_adjunto?'':'disabled'}>📎 Justificante</button><button class="btn-no" type="button" onclick="eliminarMovimientoContable(${Number(v.id)})">🗑️ Eliminar</button>`:''}</div>`;
  abrirStaSheet(v.id?'Editar movimiento':(v.tipo==='ingreso'?'Nuevo ingreso':'Nuevo gasto'),html);
}
function staArchivoBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||'');resolve(s.includes(',')?s.split(',')[1]:s)};r.onerror=()=>reject(r.error||new Error('No se pudo leer el archivo'));r.readAsDataURL(file)})}
async function guardarMovimientoContable(){
  const msg=document.getElementById('contaMovMsg'),file=document.getElementById('contaMovAdjunto')?.files?.[0]||null;
  const id=Number(document.getElementById('contaMovId')?.value||0)||null,fecha=document.getElementById('contaMovFecha')?.value||'',tipo=document.getElementById('contaMovTipo')?.value||'gasto',area=document.getElementById('contaMovArea')?.value||'general',eventoId=Number(document.getElementById('contaMovEvento')?.value||0)||null,categoria=document.getElementById('contaMovCategoria')?.value||'Otros',estado=document.getElementById('contaMovEstado')?.value||'registrado',concepto=document.getElementById('contaMovConcepto')?.value.trim()||'',tercero=document.getElementById('contaMovTercero')?.value.trim()||'',nif=document.getElementById('contaMovNif')?.value.trim()||'',importe=Number(document.getElementById('contaMovImporte')?.value||0),notas=document.getElementById('contaMovNotas')?.value.trim()||'',eliminar=Boolean(document.getElementById('contaMovEliminarAdjunto')?.checked);
  if(!fecha||!concepto||!Number.isFinite(importe)||importe<0){if(msg)msg.textContent='⚠️ Completa fecha, concepto e importe.';return}
  if(file&&file.size>5*1024*1024){if(msg)msg.textContent='⚠️ El justificante supera 5 MB.';return}
  if(msg)msg.textContent='Cifrando y guardando…';
  try{const base64=file?await staArchivoBase64(file):null;const {error}=await supabaseClient.rpc('guardar_movimiento_contable',{p_id:id,p_fecha:fecha,p_tipo:tipo,p_area:area,p_evento_id:eventoId,p_categoria:categoria,p_estado:estado,p_concepto:concepto,p_tercero:tercero||null,p_nif:nif||null,p_importe:importe,p_notas:notas||null,p_adjunto_nombre:file?.name||null,p_adjunto_mime:file?.type||null,p_adjunto_base64:base64,p_eliminar_adjunto:eliminar});if(error)throw error;if(msg)msg.textContent='✅ Movimiento guardado.';await cargarContabilidad();setTimeout(()=>cerrarStaSheet(),350)}catch(e){console.error(e);if(msg)msg.textContent='❌ No se ha podido guardar. '+(e.message||'')}
}
async function eliminarMovimientoContable(id){if(!confirm('¿Eliminar definitivamente este movimiento contable?'))return;const {error}=await supabaseClient.rpc('eliminar_movimiento_contable',{p_id:Number(id)});if(error){console.error(error);alert('No se ha podido eliminar. '+(error.message||''));return}cerrarStaSheet();await cargarContabilidad()}
async function descargarAdjuntoContable(id){
  const {data,error}=await supabaseClient.rpc('obtener_adjunto_contable',{p_id:Number(id)});if(error){console.error(error);alert('No se ha podido abrir el justificante.');return}const d=Array.isArray(data)?data[0]:data;if(!d?.contenido_base64){alert('Este movimiento no tiene justificante.');return}try{const bin=atob(d.contenido_base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const blob=new Blob([bytes],{type:d.mime||'application/octet-stream'});await staGuardarBlobCompatible(blob,d.nombre||'justificante',{selectorArchivo:true})}catch(e){console.error(e);alert('No se ha podido reconstruir el archivo.')}
}
async function exportarContabilidadExcel(){
  if(!window.ExcelJS){alert('No se ha podido cargar el generador de Excel.');return}const y=Number(document.getElementById('contaFiltroAnio')?.value||new Date().getFullYear()),rows=staContabilidadCache.filter(m=>Number(String(m.fecha||'').slice(0,4))===y);if(!rows.length){alert('No hay movimientos en ese año.');return}
  const wb=new ExcelJS.Workbook();wb.creator='Spirit to All';wb.created=new Date();const ws=wb.addWorksheet('Movimientos');ws.views=[{state:'frozen',ySplit:1}];ws.columns=[{header:'Fecha',key:'fecha',width:13},{header:'Tipo',key:'tipo',width:11},{header:'Área',key:'area',width:18},{header:'Evento',key:'evento',width:32},{header:'Categoría',key:'categoria',width:24},{header:'Concepto',key:'concepto',width:42},{header:'Tercero',key:'tercero',width:28},{header:'NIF/CIF',key:'nif',width:18},{header:'Importe (€)',key:'importe',width:14},{header:'Estado',key:'estado',width:13},{header:'Notas',key:'notas',width:38},{header:'Justificante',key:'adjunto',width:18}];rows.forEach(m=>ws.addRow({fecha:m.fecha,tipo:m.tipo,area:staContaAreaLabel(m.area),evento:m.evento_id?staContaEventoLabel(m.evento_id):'General / sin evento',categoria:m.categoria,concepto:m.concepto,tercero:m.tercero||'',nif:m.nif||'',importe:Number(m.importe||0),estado:m.estado,notas:m.notas||'',adjunto:m.tiene_adjunto?'Sí':'No'}));ws.getRow(1).font={bold:true};ws.autoFilter={from:'A1',to:'L1'};ws.getColumn('importe').numFmt='#,##0.00 "€"';
  const areas=wb.addWorksheet('Resumen áreas');areas.columns=[{header:'Área',key:'area',width:22},{header:'Ingresos',key:'ing',width:16},{header:'Gastos',key:'gas',width:16},{header:'Balance',key:'bal',width:16}];for(const [k,v] of staResumenRows(rows,m=>m.area||'general'))areas.addRow({area:staContaAreaLabel(k),ing:v.ing,gas:v.gas,bal:v.ing-v.gas});areas.getRow(1).font={bold:true};['ing','gas','bal'].forEach(k=>areas.getColumn(k).numFmt='#,##0.00 "€"');
  const evs=wb.addWorksheet('Resumen eventos');evs.columns=[{header:'Evento',key:'evento',width:42},{header:'Ingresos',key:'ing',width:16},{header:'Gastos',key:'gas',width:16},{header:'Balance',key:'bal',width:16}];for(const [k,v] of staResumenRows(rows,m=>m.evento_id?String(m.evento_id):'general'))evs.addRow({evento:k==='general'?'General / sin evento':staContaEventoLabel(Number(k)),ing:v.ing,gas:v.gas,bal:v.ing-v.gas});evs.getRow(1).font={bold:true};['ing','gas','bal'].forEach(k=>evs.getColumn(k).numFmt='#,##0.00 "€"');
  const buf=await wb.xlsx.writeBuffer(),blob=new Blob([buf],{type:STA_XLSX_MIME});await staGuardarBlobCompatible(blob,`Contabilidad_Spirit_to_All_${y}.xlsx`,{selectorArchivo:true});
}
function staAbrirGastoAreaProduccion(areaId){
  if(!staPuedeEditarAreaProduccion(areaId))return;const eventoId=Number(staProduccionEventoId||0)||null;cerrarStaSheet();abrirPresupuestosDirecto();cambiarDineroVista('contabilidad');setTimeout(()=>abrirMovimientoContable(null,'gasto',areaId,eventoId),220);
}

// Añade el acceso contable a cada área sin mezclar la contabilidad con sus tareas.
function staHtmlAreaProduccion(area){
  const r=staAreaResumen(area),resp=area.id==='ministerio'?(staProduccionMinisterio?.responsable||''):(staProduccionFicha?.[area.campo]||'');
  const tareas=`${r.tareas.map(staHtmlTareaProduccion).join('')||'<div class="sta-prod-empty-help">Todavía no hay tareas en esta área. Puedes crear la primera debajo.</div>'}<div class="sta-prod-add"><input id="prodNueva-${area.id}" maxlength="160" placeholder="Nueva tarea"><button class="btn-dark" type="button" onclick="staAgregarTareaProduccion('${area.id}')">＋ Añadir</button></div>`;
  const contenidoLogistica=area.id==='logistica'?`<div class="sta-prod-subtabs"><button type="button" class="sta-prod-subtab ${staProduccionLogisticaTab==='tecnica'?'active':''}" onclick="staCambiarVistaLogistica('tecnica')">🎛️ Técnica y montaje</button><button type="button" class="sta-prod-subtab ${staProduccionLogisticaTab==='tareas'?'active':''}" onclick="staCambiarVistaLogistica('tareas')">📋 Tareas <em>${r.texto}</em></button></div>${staProduccionLogisticaTab==='tecnica'?staHtmlLogisticaTecnica():tareas}`:null;
  const contenidoCreatividad=area.id==='creatividad'?`<div class="sta-prod-subtabs"><button type="button" class="sta-prod-subtab ${staProduccionCreatividadTab==='vestuario'?'active':''}" onclick="staCambiarVistaCreatividad('vestuario')">👗 Vestuario</button><button type="button" class="sta-prod-subtab ${staProduccionCreatividadTab==='tareas'?'active':''}" onclick="staCambiarVistaCreatividad('tareas')">📋 Tareas <em>${r.texto}</em></button></div>${staProduccionCreatividadTab==='vestuario'?staHtmlVestuarioCreatividad():tareas}`:null;
  const contenido=contenidoLogistica??contenidoCreatividad??tareas;
  const gasto=`<div class="sta-prod-accounting-shortcut"><span>¿Ha habido un gasto en esta área?</span><button class="btn-light" type="button" onclick="staAbrirGastoAreaProduccion('${area.id}')">💶 Registrar gasto</button></div>`;
  return `<section id="staProdPanelActivo" class="sta-prod-active-panel"><div class="sta-prod-area-hero"><span class="ico">${area.icono}</span><span class="sta-prod-area-hero-copy"><strong>${escapeHtml(area.nombre)}</strong><small>${escapeHtml(area.sub)}</small></span><span class="sta-prod-count ${r.clase}">${r.texto}</span></div><div class="sta-prod-area-body"><div class="sta-prod-resp"><label class="control-label">Ministro/a o responsable<input id="prodResp-${area.id}" value="${escapeHtml(resp)}" placeholder="Nombre de la persona responsable"></label><button class="btn-light" type="button" onclick="staGuardarResponsableArea('${area.id}')">Guardar</button></div>${gasto}${contenido}</div></section>`;
}
