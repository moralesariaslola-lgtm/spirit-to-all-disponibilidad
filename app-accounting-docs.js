// =========================================================
// CONTABILIDAD DOCUMENTAL · 2026-10-06
// =========================================================
let staDocumentosContablesCache=[];
let staDocFilesPendientes=[];
let staMovFilesPendientes=[];
let staContaVistaActual='movimientos';

var staCerrarPantallasBase=typeof cerrarPantallasHerramientas==='function'?cerrarPantallasHerramientas:null;
cerrarPantallasHerramientas=function(excepto=''){
  ['panelGestor','panelCalendario','panelWhatsapp','panelUsuarios','panelContabilidad'].forEach(id=>{if(id!==excepto)document.getElementById(id)?.classList.add('hidden')});
  if(typeof marcarNavActivo==='function')marcarNavActivo(excepto);document.body.style.overflow='';
};

var staInicioAbrirBase=staInicioAbrir;
staInicioAbrir=function(tipo,btn){if(tipo==='contabilidad'){staHomeMarcar(btn);abrirContabilidadDirecto();return}return staInicioAbrirBase(tipo,btn)};
var staAtrasFisicoBase=staAtrasFisicoGestion;
staAtrasFisicoGestion=function(){const p=document.getElementById('panelContabilidad');if(p&&!p.classList.contains('hidden')){cerrarContabilidad(false);return true}return staAtrasFisicoBase()};

let staContabilidadContextoBolo=null;
function abrirContabilidadDirecto(eventoId=null){
  if(!staTienePermiso('contabilidad'))return;cerrarPantallasHerramientas('panelContabilidad');
  staContabilidadContextoBolo=eventoId;
  document.getElementById('panelContabilidad')?.classList.remove('hidden');document.body.style.overflow='hidden';
  if(eventoId){
    staPrepararFiltrosContabilidad();
    const selector=document.getElementById('contaExpedienteEvento');
    selector.value=String(eventoId);
  }
  cambiarVistaContabilidad(eventoId?'expedientes':staContaVistaActual||'movimientos');
  cargarContabilidad();staPushEstadoPwa('contabilidad');
}
function cerrarContabilidad(reemplazar=true){document.getElementById('panelContabilidad')?.classList.add('hidden');document.body.style.overflow='';if(reemplazar)staReplaceEstadoPwa(null)}

// Dinero queda reservado a Presupuestos y Facturación; Contabilidad es una herramienta propia.
cambiarDineroVista=function(vista){
  if(vista==='contabilidad'){abrirContabilidadDirecto();return}
  const facturas=vista==='facturas',presupuestos=!facturas;
  document.getElementById('moneyPresupuestos')?.classList.toggle('hidden',!presupuestos);
  document.getElementById('moneyFacturas')?.classList.toggle('hidden',!facturas);
  document.getElementById('moneyTabPresupuestos')?.classList.toggle('active',presupuestos);
  document.getElementById('moneyTabFacturas')?.classList.toggle('active',facturas);
  if(facturas){cargarDatosEmisorSeguro();cargarFacturas()}else cargarSelectorPresupuestos();
};

function cambiarVistaContabilidad(vista){
  staContaVistaActual=['movimientos','documentos','expedientes'].includes(vista)?vista:'movimientos';
  const map={movimientos:'contaVistaMovimientos',documentos:'contaVistaDocumentos',expedientes:'contaVistaExpedientes'};
  ['movimientos','documentos','expedientes'].forEach(v=>{
    document.getElementById(map[v])?.classList.toggle('hidden',v!==staContaVistaActual);
    const id=v==='movimientos'?'contaTabMovimientos':v==='documentos'?'contaTabDocumentos':'contaTabExpedientes';
    const tab=document.getElementById(id);tab?.classList.toggle('active',v===staContaVistaActual);tab?.setAttribute('aria-selected',String(v===staContaVistaActual));
  });
  if(staContaVistaActual==='documentos')pintarDocumentacionContable();
  if(staContaVistaActual==='expedientes')pintarExpedienteContable();
}

function staTipoDocumentoLabel(t){return({factura:'Factura',ticket:'Ticket',justificante_pago:'Justificante de pago',presupuesto:'Presupuesto',contrato:'Contrato',otro:'Otro'})[t]||'Documento'}
function staTipoDocumentoIcon(t){return({factura:'🧾',ticket:'🧾',justificante_pago:'💳',presupuesto:'€',contrato:'📄',otro:'📎'})[t]||'📎'}
function staTipoDocumentoOptions(actual='otro'){return ['factura','ticket','justificante_pago','presupuesto','contrato','otro'].map(t=>`<option value="${t}" ${t===actual?'selected':''}>${staTipoDocumentoLabel(t)}</option>`).join('')}
function staContaMovimientoOptions(actual=null){return `<option value="">Sin movimiento asociado</option>`+staContabilidadCache.filter(m=>m.estado!=='anulado').slice(0,120).map(m=>`<option value="${Number(m.id)}" ${Number(actual)===Number(m.id)?'selected':''}>${escapeHtml(formatearFechaCorta(m.fecha||''))} · ${escapeHtml(m.concepto||'Movimiento')} · ${escapeHtml(staContaEuros(m.importe))}</option>`).join('')}
function staSanitizeFileName(s){return String(s||'documento').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'documento'}
function staBytesDesdeBase64(b64){const bin=atob(String(b64||'')),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}

async function cargarContabilidad(){
  if(!esGestor()||staContabilidadCargando)return;staContabilidadCargando=true;
  const box=document.getElementById('contaLista');if(box)box.innerHTML='<div class="sta-empty-state">Cargando contabilidad…</div>';
  try{
    const [mov,docs]=await Promise.all([
      supabaseClient.rpc('listar_movimientos_contables',{p_anio:null,p_evento_id:null,p_area:null,p_tipo:null}),
      supabaseClient.rpc('listar_documentos_contables',{p_anio:null,p_evento_id:null,p_movimiento_id:null,p_area:null})
    ]);
    if(mov.error)throw mov.error;if(docs.error)throw docs.error;
    staContabilidadCache=mov.data||[];staDocumentosContablesCache=docs.data||[];
    staPrepararFiltrosContabilidad();pintarContabilidad();pintarDocumentacionContable();if(staContaVistaActual==='expedientes')await pintarExpedienteContable();
  }catch(e){console.error(e);if(box)box.innerHTML='<div class="finance-note"><strong>No se ha podido cargar Contabilidad.</strong><br>Vuelve a intentarlo o comprueba tu sesión.</div>'}
  finally{staContabilidadCargando=false}
}

staPrepararFiltrosContabilidad=function(){
  const now=new Date().getFullYear(),yrs=new Set([now]);
  staContabilidadCache.forEach(m=>m.fecha&&yrs.add(Number(String(m.fecha).slice(0,4))));
  staDocumentosContablesCache.forEach(d=>(d.fecha_documento||d.creado_en)&&yrs.add(Number(String(d.fecha_documento||d.creado_en).slice(0,4))));
  (eventosActuales||[]).forEach(e=>e.fecha&&yrs.add(Number(String(e.fecha).slice(0,4))));
  const yearOptions=[...yrs].filter(Boolean).sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join('');
  ['contaFiltroAnio','contaDocFiltroAnio'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const prev=el.value||String(now);el.innerHTML=yearOptions;el.value=[...yrs].map(String).includes(prev)?prev:String(now)});
  const areaOpts='<option value="">Todas</option>'+staContaAreasDisponibles().map(a=>`<option value="${a}">${escapeHtml(staContaAreaLabel(a))}</option>`).join('');
  ['contaFiltroArea','contaDocFiltroArea'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const prev=el.value;el.innerHTML=areaOpts;if([...el.options].some(o=>o.value===prev))el.value=prev});
  const vinculados=new Set([...staContabilidadCache,...staDocumentosContablesCache].map(x=>Number(x.evento_id)).filter(Boolean));const evOpts=(eventosActuales||[]).filter(e=>staContaEventoActivo(e)||vinculados.has(Number(e.id))).slice().sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).map(e=>`<option value="${Number(e.id)}">${escapeHtml(staContaEventoLabel(e.id))}${staContaEventoActivo(e)?'':' · Cancelado (histórico)'}</option>`).join('');
  const f=document.getElementById('contaFiltroEvento');if(f){const prev=f.value;f.innerHTML='<option value="">Todos</option>'+evOpts;if([...f.options].some(o=>o.value===prev))f.value=prev}
  const d=document.getElementById('contaDocFiltroEvento');if(d){const prev=d.value;d.innerHTML='<option value="">Todos / general</option>'+evOpts;if([...d.options].some(o=>o.value===prev))d.value=prev}
  const ex=document.getElementById('contaExpedienteEvento');if(ex){const prev=staContabilidadContextoBolo?String(staContabilidadContextoBolo):ex.value||'general';ex.innerHTML='<option value="general">📁 Documentación general</option>'+evOpts;if([...ex.options].some(o=>o.value===prev))ex.value=prev}
};

pintarContabilidad=function(){
  if(!document.getElementById('panelContabilidad'))return;
  const faltan=staContabilidadCache.filter(m=>m.estado!=='anulado'&&!staDocumentosContablesCache.some(d=>Number(d.movimiento_id)===Number(m.id)&&d.estado==='activo')).length;const contador=document.getElementById('contaFaltanJustificantes');if(contador)contador.textContent=faltan?'('+faltan+')':'(0)';
  const rows=staContabilidadFiltrada(),ing=rows.filter(x=>x.tipo==='ingreso'&&x.estado!=='anulado').reduce((a,x)=>a+Number(x.importe||0),0),gas=rows.filter(x=>x.tipo==='gasto'&&x.estado!=='anulado').reduce((a,x)=>a+Number(x.importe||0),0);
  document.getElementById('contaIngresos').textContent=staContaEuros(ing);document.getElementById('contaGastos').textContent=staContaEuros(gas);document.getElementById('contaBalance').textContent=staContaEuros(ing-gas);
  const lista=document.getElementById('contaLista');if(lista)lista.innerHTML=rows.length?rows.map(m=>{const esIng=m.tipo==='ingreso',evt=m.evento_id?staContaEventoLabel(m.evento_id):'Sin evento',docs=staDocumentosContablesCache.filter(d=>Number(d.movimiento_id)===Number(m.id)&&d.estado==='activo').length;return `<button class="conta-item ${esIng?'ingreso':'gasto'} ${m.estado==='anulado'?'anulado':''}" type="button" onclick="abrirMovimientoContable(${Number(m.id)})"><span class="ico">${esIng?'↗️':'↘️'}</span><span><strong>${escapeHtml(m.concepto||'Movimiento')}</strong><small>✏️ Toca para editar · ${escapeHtml(formatearFechaCorta(m.fecha||''))} · ${escapeHtml(staContaAreaLabel(m.area))} · ${escapeHtml(evt)}${docs?' · 📎 '+docs:(m.estado!=='anulado'?' · ⚠️ sin justificante':'')}</small></span><span class="amount">${esIng?'+':'−'} ${escapeHtml(staContaEuros(m.importe))}<small>${escapeHtml(m.estado||'')}</small></span></button>`}).join(''):'<div class="conta-empty">No hay movimientos con estos filtros.</div>';
  staPintarResumenContabilidad();
};

staPintarResumenContabilidad=function(){
  const y=Number(document.getElementById('contaFiltroAnio')?.value||new Date().getFullYear()),base=staContabilidadCache.filter(m=>Number(String(m.fecha||'').slice(0,4))===y);
  const meses=staResumenRows(base,m=>String(m.fecha||'').slice(0,7)),mb=document.getElementById('contaResumenMeses');
  if(mb)mb.innerHTML=[...meses.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([k,v])=>{const [yy,mm]=k.split('-'),nom=new Intl.DateTimeFormat('es-ES',{month:'long'}).format(new Date(Number(yy),Number(mm)-1,1));return `<div class="conta-summary-line"><span>${escapeHtml(nom.charAt(0).toUpperCase()+nom.slice(1))}</span><small>Ingresos ${escapeHtml(staContaEuros(v.ing))} · Gastos ${escapeHtml(staContaEuros(v.gas))} · <strong>${escapeHtml(staContaEuros(v.ing-v.gas))}</strong></small></div>`}).join('')||'<div class="muted">Sin movimientos.</div>';
  const areas=staResumenRows(base,m=>m.area||'general'),aBox=document.getElementById('contaResumenAreas');if(aBox)aBox.innerHTML=[...areas.entries()].map(([k,v])=>`<div class="conta-summary-card"><strong>${escapeHtml(staContaAreaLabel(k))}</strong><small>+ ${escapeHtml(staContaEuros(v.ing))} · − ${escapeHtml(staContaEuros(v.gas))}<br>Balance ${escapeHtml(staContaEuros(v.ing-v.gas))}</small></div>`).join('')||'<div class="muted">Sin movimientos.</div>';
  const evs=staResumenRows(base,m=>m.evento_id?String(m.evento_id):'general'),eBox=document.getElementById('contaResumenEventos');if(eBox)eBox.innerHTML=[...evs.entries()].map(([k,v])=>`<div class="conta-summary-line"><span>${escapeHtml(k==='general'?'Sin evento / general':staContaEventoLabel(Number(k)))}</span><small>Ingresos ${escapeHtml(staContaEuros(v.ing))} · Gastos ${escapeHtml(staContaEuros(v.gas))} · <strong>${escapeHtml(staContaEuros(v.ing-v.gas))}</strong></small></div>`).join('')||'<div class="muted">Sin movimientos.</div>';
};

function staDocFiltrados(){
  const y=Number(document.getElementById('contaDocFiltroAnio')?.value||new Date().getFullYear()),area=document.getElementById('contaDocFiltroArea')?.value||'',evt=Number(document.getElementById('contaDocFiltroEvento')?.value||0)||null,tipo=document.getElementById('contaDocFiltroTipo')?.value||'',q=staNormalizarBusqueda(document.getElementById('contaDocBuscar')?.value||'');
  return staDocumentosContablesCache.filter(d=>Number(String(d.fecha_documento||d.creado_en||'').slice(0,4))===y&&(!area||d.area===area)&&(!evt||Number(d.evento_id)===evt)&&(!tipo||d.tipo_documento===tipo)&&(!q||staNormalizarBusqueda(`${d.nombre||''} ${d.numero||''} ${d.tercero||''} ${d.nif||''} ${d.notas||''} ${staTipoDocumentoLabel(d.tipo_documento)} ${staContaEventoLabel(d.evento_id)}`).includes(q)));
}
function pintarDocumentacionContable(){
  const box=document.getElementById('contaDocsLista');if(!box)return;const rows=staDocFiltrados();
  document.getElementById('contaDocTotal').textContent=`${rows.length} documento${rows.length===1?'':'s'}`;const faltan=staContabilidadCache.filter(m=>m.estado!=='anulado'&&!staDocsMovimiento(m.id).some(d=>d.estado==='activo')).length;const dp=document.getElementById('contaDocPendientes');if(dp)dp.textContent=faltan?`⚠️ ${faltan} movimiento(s) sin justificante`:'✅ Justificantes al día';
  box.innerHTML=rows.length?rows.map(d=>`<button class="conta-doc-item ${d.estado==='anulado'?'anulado':''}" type="button" onclick="abrirDocumentoContable(${Number(d.id)})"><span class="doc-ico">${staTipoDocumentoIcon(d.tipo_documento)}</span><span><strong>${escapeHtml(d.nombre||staTipoDocumentoLabel(d.tipo_documento))}</strong><small>${escapeHtml(staTipoDocumentoLabel(d.tipo_documento))} · ${escapeHtml(formatearFechaCorta(d.fecha_documento||String(d.creado_en||'').slice(0,10)))} · ${escapeHtml(staContaAreaLabel(d.area))}${d.evento_id?' · '+escapeHtml(staContaEventoLabel(d.evento_id)):' · General'}</small></span><span class="doc-side">${d.importe!=null?escapeHtml(staContaEuros(d.importe)):''}<small>${escapeHtml(d.estado||'activo')}</small></span></button>`).join(''):'<div class="conta-empty">No hay documentos con estos filtros.</div>';
}

let staDocumentoEventoPendiente=null;
function staAdjuntarDocumentoExpediente(){const ex=document.getElementById('contaExpedienteEvento')?.value||'general';staDocumentoEventoPendiente=ex==='general'?null:Number(ex);document.getElementById('contaDocArchivos')?.click()}
function staNuevoDocumentoDesdeInput(input){const files=Array.from(input?.files||[]);input.value='';if(!files.length)return;const ex=document.getElementById('contaExpedienteEvento')?.value||'general';const eventId=staDocumentoEventoPendiente||(staContaVistaActual==='expedientes'&&ex!=='general'?Number(ex):null);staDocumentoEventoPendiente=null;cambiarVistaContabilidad('documentos');abrirNuevoDocumentoContable(files,eventId?{evento_id:eventId}:{})}
function staSincronizarDocMovimiento(id){const m=staContabilidadCache.find(x=>Number(x.id)===Number(id));if(!m)return;const area=document.getElementById('contaDocArea'),evt=document.getElementById('contaDocEvento'),ter=document.getElementById('contaDocTercero'),nif=document.getElementById('contaDocNif'),imp=document.getElementById('contaDocImporte'),fecha=document.getElementById('contaDocFecha');if(area)area.value=m.area||'general';if(evt)evt.value=m.evento_id?String(m.evento_id):'';if(ter&&!ter.value)ter.value=m.tercero||'';if(nif&&!nif.value)nif.value=m.nif||'';if(imp&&!imp.value)imp.value=m.importe??'';if(fecha&&!fecha.value)fecha.value=m.fecha||''}
function abrirNuevoDocumentoContable(files=[],defaults={}){
  if(!esGestor())return;staDocFilesPendientes=Array.from(files||[]);if(!staDocFilesPendientes.length){alert('Selecciona al menos un archivo.');return}
  const names=staDocFilesPendientes.map(f=>`${escapeHtml(f.name)} · ${(f.size/1024/1024).toFixed(2)} MB`).join('<br>');
  const d={fecha:defaults.fecha||staFechaMadrid(),area:defaults.area||'general',evento_id:defaults.evento_id||null,movimiento_id:defaults.movimiento_id||null,tipo_documento:defaults.tipo_documento||'factura',tercero:defaults.tercero||'',nif:defaults.nif||'',importe:defaults.importe??'',notas:defaults.notas||'',numero:''};
  const html=`<div class="sta-sheet-intro"><strong>Archivar documentación</strong><p>Los archivos y metadatos sensibles se almacenan cifrados. Puedes vincularlos a un movimiento, un evento o dejarlos como documentación general.</p></div><div class="conta-files-preview">${names}</div><div class="conta-doc-form-grid"><label class="control-label">Tipo<select id="contaDocTipo">${staTipoDocumentoOptions(d.tipo_documento)}</select></label><label class="control-label">Fecha<input id="contaDocFecha" type="date" value="${escapeHtml(d.fecha)}"></label><label class="control-label">Área<select id="contaDocArea">${staContaAreaOptions(d.area)}</select></label><label class="control-label">Evento<select id="contaDocEvento">${staContaEventoOptions(d.evento_id)}</select></label><label class="control-label full">Movimiento relacionado<select id="contaDocMovimiento" onchange="staSincronizarDocMovimiento(this.value)">${staContaMovimientoOptions(d.movimiento_id)}</select></label><label class="control-label">Nº factura / documento<input id="contaDocNumero" value=""></label><label class="control-label">Importe total (€)<input id="contaDocImporte" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(d.importe)}"></label><label class="control-label">Base imponible (€)<input id="contaDocBase" type="number" min="0" step="0.01" inputmode="decimal"></label><label class="control-label">IVA (%)<input id="contaDocIva" type="number" min="0" max="100" step="0.01" inputmode="decimal"></label><label class="control-label">Proveedor / cliente<input id="contaDocTercero" value="${escapeHtml(d.tercero)}"></label><label class="control-label">NIF / CIF<input id="contaDocNif" value="${escapeHtml(d.nif)}"></label><label class="control-label full">Forma de pago<input id="contaDocPago" placeholder="Transferencia, tarjeta, efectivo…"></label><label class="control-label full">Notas<textarea id="contaDocNotas" rows="3">${escapeHtml(d.notas)}</textarea></label></div><div id="contaDocMsg" class="muted" style="margin-top:8px"></div><button class="btn-primary btn-full" type="button" onclick="guardarDocumentosContablesNuevos()">🔐 Guardar ${staDocFilesPendientes.length} documento${staDocFilesPendientes.length===1?'':'s'}</button>`;
  abrirStaSheet('Archivar documentación',html);
}
async function staGuardarUnDocumento(file,meta,permitir=false){
  if(file.size>5*1024*1024)throw new Error(`${file.name}: supera 5 MB`);const base64=await staArchivoBase64(file);
  const {data,error}=await supabaseClient.rpc('guardar_documento_contable',{p_movimiento_id:meta.movimiento_id||null,p_evento_id:meta.evento_id||null,p_area:meta.area,p_tipo_documento:meta.tipo_documento,p_fecha_documento:meta.fecha_documento||null,p_numero:meta.numero||null,p_tercero:meta.tercero||null,p_nif:meta.nif||null,p_base_imponible:meta.base_imponible??null,p_iva_porcentaje:meta.iva_porcentaje??null,p_importe:meta.importe,p_forma_pago:meta.forma_pago||null,p_notas:meta.notas||null,p_nombre:file.name,p_mime:file.type||'application/octet-stream',p_contenido_base64:base64,p_permitir_duplicado:Boolean(permitir)});
  if(error){const msg=String(error.message||'');if(msg.includes('POSIBLE_DUPLICADO')&&!permitir){const ok=confirm(`⚠️ Posible documento duplicado detectado para «${file.name}».\n\n¿Quieres guardarlo igualmente?`);if(ok)return staGuardarUnDocumento(file,meta,true)}throw error}return Array.isArray(data)?data[0]:data;
}
async function guardarDocumentosContablesNuevos(){
  const msg=document.getElementById('contaDocMsg'),importeRaw=document.getElementById('contaDocImporte')?.value;
  const baseRaw=document.getElementById('contaDocBase')?.value||'',ivaRaw=document.getElementById('contaDocIva')?.value||'';const meta={movimiento_id:Number(document.getElementById('contaDocMovimiento')?.value||0)||null,evento_id:Number(document.getElementById('contaDocEvento')?.value||0)||null,area:document.getElementById('contaDocArea')?.value||'general',tipo_documento:document.getElementById('contaDocTipo')?.value||'otro',fecha_documento:document.getElementById('contaDocFecha')?.value||null,numero:document.getElementById('contaDocNumero')?.value.trim()||'',tercero:document.getElementById('contaDocTercero')?.value.trim()||'',nif:document.getElementById('contaDocNif')?.value.trim()||'',base_imponible:baseRaw===''?null:Number(baseRaw),iva_porcentaje:ivaRaw===''?null:Number(ivaRaw),importe:importeRaw===''?null:Number(importeRaw),forma_pago:document.getElementById('contaDocPago')?.value.trim()||'',notas:document.getElementById('contaDocNotas')?.value.trim()||''};
  if((meta.importe!=null&&(!Number.isFinite(meta.importe)||meta.importe<0))||(meta.base_imponible!=null&&(!Number.isFinite(meta.base_imponible)||meta.base_imponible<0))||(meta.iva_porcentaje!=null&&(!Number.isFinite(meta.iva_porcentaje)||meta.iva_porcentaje<0||meta.iva_porcentaje>100))){if(msg)msg.textContent='⚠️ Revisa importe, base e IVA.';return}if(msg)msg.textContent='Cifrando y archivando…';
  try{for(const f of staDocFilesPendientes)await staGuardarUnDocumento(f,meta,false);staDocFilesPendientes=[];if(msg)msg.textContent='✅ Documentación archivada.';await cargarContabilidad();setTimeout(()=>cerrarStaSheet(),350)}catch(e){console.error(e);if(msg)msg.textContent='❌ '+(e.message||'No se ha podido guardar la documentación.')}
}

function abrirDocumentoContable(id,desdeSheet=false){
  const d=staDocumentosContablesCache.find(x=>Number(x.id)===Number(id));if(!d)return;const html=`<div class="sta-sheet-intro"><strong>${staTipoDocumentoIcon(d.tipo_documento)} ${escapeHtml(d.nombre||'Documento')}</strong><p>${escapeHtml(staTipoDocumentoLabel(d.tipo_documento))} · ${d.tamano?Math.round(Number(d.tamano)/1024)+' KB':''}</p></div><div class="conta-doc-form-grid"><label class="control-label">Tipo<select id="contaEditDocTipo">${staTipoDocumentoOptions(d.tipo_documento)}</select></label><label class="control-label">Fecha<input id="contaEditDocFecha" type="date" value="${escapeHtml(d.fecha_documento||'')}"></label><label class="control-label">Área<select id="contaEditDocArea">${staContaAreaOptions(d.area)}</select></label><label class="control-label">Evento<select id="contaEditDocEvento">${staContaEventoOptions(d.evento_id)}</select></label><label class="control-label">Nº factura / documento<input id="contaEditDocNumero" value="${escapeHtml(d.numero||'')}"></label><label class="control-label">Importe total (€)<input id="contaEditDocImporte" type="number" min="0" step="0.01" value="${escapeHtml(d.importe??'')}"></label><label class="control-label">Base imponible (€)<input id="contaEditDocBase" type="number" min="0" step="0.01" value="${escapeHtml(d.base_imponible??'')}"></label><label class="control-label">IVA (%)<input id="contaEditDocIva" type="number" min="0" max="100" step="0.01" value="${escapeHtml(d.iva_porcentaje??'')}"></label><label class="control-label">Proveedor / cliente<input id="contaEditDocTercero" value="${escapeHtml(d.tercero||'')}"></label><label class="control-label">NIF / CIF<input id="contaEditDocNif" value="${escapeHtml(d.nif||'')}"></label><label class="control-label full">Forma de pago<input id="contaEditDocPago" value="${escapeHtml(d.forma_pago||'')}"></label><label class="control-label full">Notas<textarea id="contaEditDocNotas" rows="3">${escapeHtml(d.notas||'')}</textarea></label></div><div id="contaEditDocMsg" class="muted"></div><div class="conta-sheet-actions"><button class="btn-primary wide" type="button" onclick="guardarCambiosDocumentoContable(${Number(d.id)})">💾 Guardar ficha</button><button class="btn-light" type="button" onclick="descargarDocumentoContable(${Number(d.id)})">👁 Abrir archivo</button><button class="btn-light" type="button" onclick="abrirAuditoriaContable('documento',${Number(d.id)})">🕘 Historial</button>${d.estado!=='anulado'?`<button class="btn-no wide" type="button" onclick="anularDocumentoContable(${Number(d.id)})">Anular documento</button>`:''}</div>`;
  if(desdeSheet)pushStaSheet('Documento',html);else abrirStaSheet('Documento',html);
}
async function guardarCambiosDocumentoContable(id,permitir=false){
  const msg=document.getElementById('contaEditDocMsg'),raw=document.getElementById('contaEditDocImporte')?.value,baseRaw=document.getElementById('contaEditDocBase')?.value||'',ivaRaw=document.getElementById('contaEditDocIva')?.value||'',payload={p_id:Number(id),p_evento_id:Number(document.getElementById('contaEditDocEvento')?.value||0)||null,p_area:document.getElementById('contaEditDocArea')?.value||'general',p_tipo_documento:document.getElementById('contaEditDocTipo')?.value||'otro',p_fecha_documento:document.getElementById('contaEditDocFecha')?.value||null,p_numero:document.getElementById('contaEditDocNumero')?.value.trim()||null,p_tercero:document.getElementById('contaEditDocTercero')?.value.trim()||null,p_nif:document.getElementById('contaEditDocNif')?.value.trim()||null,p_base_imponible:baseRaw===''?null:Number(baseRaw),p_iva_porcentaje:ivaRaw===''?null:Number(ivaRaw),p_importe:raw===''?null:Number(raw),p_forma_pago:document.getElementById('contaEditDocPago')?.value.trim()||null,p_notas:document.getElementById('contaEditDocNotas')?.value.trim()||null,p_permitir_duplicado:Boolean(permitir)};
  if(msg)msg.textContent='Guardando…';const {error}=await supabaseClient.rpc('actualizar_documento_contable',payload);if(error){if(String(error.message||'').includes('POSIBLE_DUPLICADO')&&!permitir&&confirm('⚠️ Estos datos coinciden con otro documento. ¿Guardar igualmente?'))return guardarCambiosDocumentoContable(id,true);console.error(error);if(msg)msg.textContent='❌ '+(error.message||'No se pudo guardar.');return}if(msg)msg.textContent='✅ Ficha actualizada.';await cargarContabilidad();
}
async function descargarDocumentoContable(id){const {data,error}=await supabaseClient.rpc('obtener_documento_contable',{p_id:Number(id)});if(error){console.error(error);alert('No se ha podido abrir el documento.');return}const d=Array.isArray(data)?data[0]:data;if(!d?.contenido_base64){alert('Documento no disponible.');return}const blob=new Blob([staBytesDesdeBase64(d.contenido_base64)],{type:d.mime||'application/octet-stream'});await staGuardarBlobCompatible(blob,d.nombre||'documento',{selectorArchivo:true})}
async function anularDocumentoContable(id){if(!confirm('¿Anular este documento? Permanecerá en el historial, pero dejará de considerarse documentación activa.'))return;const {error}=await supabaseClient.rpc('anular_documento_contable',{p_id:Number(id)});if(error){console.error(error);alert(error.message||'No se pudo anular.');return}cerrarStaSheet();await cargarContabilidad()}

function staDocsMovimiento(id){return staDocumentosContablesCache.filter(d=>Number(d.movimiento_id)===Number(id))}
function abrirDocumentosMovimiento(id){const docs=staDocsMovimiento(id);const html=docs.length?`<div class="conta-doc-list">${docs.map(d=>`<button class="conta-doc-item ${d.estado==='anulado'?'anulado':''}" type="button" onclick="abrirDocumentoContable(${Number(d.id)},true)"><span class="doc-ico">${staTipoDocumentoIcon(d.tipo_documento)}</span><span><strong>${escapeHtml(d.nombre||'Documento')}</strong><small>${escapeHtml(staTipoDocumentoLabel(d.tipo_documento))} · ${escapeHtml(d.estado)}</small></span><span class="doc-side">›</span></button>`).join('')}</div>`:'<div class="conta-empty">Este movimiento todavía no tiene documentos archivados.</div>';pushStaSheet('Documentos del movimiento',html)}
async function abrirAuditoriaContable(entidad,id){const {data,error}=await supabaseClient.rpc('listar_auditoria_contable',{p_entidad:entidad,p_entidad_id:Number(id)});if(error){console.error(error);alert('No se ha podido cargar el historial.');return}const rows=data||[],html=rows.length?`<div class="conta-audit-list">${rows.map(a=>`<div class="conta-audit-row"><strong>${escapeHtml(a.accion||'Acción')} · ${escapeHtml(a.usuario_nombre||'Usuario')}</strong><small>${escapeHtml(new Date(a.creado_en).toLocaleString('es-ES'))}${a.detalle?'<br>'+escapeHtml(a.detalle):''}</small></div>`).join('')}</div>`:'<div class="conta-empty">Sin movimientos de auditoría.</div>';pushStaSheet('Historial de auditoría',html)}

abrirMovimientoContable=function(id=null,tipo='gasto',area='general',eventoId=null){
  if(!esGestor())return;staMovFilesPendientes=[];const m=id?staContabilidadCache.find(x=>Number(x.id)===Number(id)):null;if(id&&!m)return;
  const v=m||{id:null,fecha:staFechaMadrid(),tipo,area,evento_id:eventoId,categoria:tipo==='ingreso'?'Ingreso actuación':'Otros',estado:tipo==='ingreso'?'cobrado':'pagado',concepto:'',tercero:'',nif:'',importe:'',notas:''};const docs=v.id?staDocsMovimiento(v.id):[];
  const html=`<div class="sta-sheet-intro"><strong>${v.id?'Editar movimiento':'Nuevo '+(v.tipo==='ingreso'?'ingreso':'gasto')}</strong><p>Los datos económicos se guardan cifrados. Puedes fotografiar o adjuntar varios documentos al mismo movimiento.</p></div><div class="conta-sheet-grid"><input id="contaMovId" type="hidden" value="${v.id||''}"><label class="control-label">Tipo<select id="contaMovTipo"><option value="gasto" ${v.tipo==='gasto'?'selected':''}>Gasto</option><option value="ingreso" ${v.tipo==='ingreso'?'selected':''}>Ingreso</option></select></label><label class="control-label">Fecha<input id="contaMovFecha" type="date" value="${escapeHtml(v.fecha||'')}"></label><label class="control-label">Área<select id="contaMovArea">${staContaAreaOptions(v.area||'general')}</select></label><label class="control-label">Estado<select id="contaMovEstado">${staContaEstadoOptions(v.estado||'registrado')}</select></label><label class="control-label full">Evento relacionado<select id="contaMovEvento">${staContaEventoOptions(v.evento_id)}</select></label><label class="control-label">Categoría<select id="contaMovCategoria">${staContaCategoriaOptions(v.categoria||'Otros')}</select></label><label class="control-label">Importe (€)<input id="contaMovImporte" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(v.importe??'')}"></label><label class="control-label full">Concepto<input id="contaMovConcepto" maxlength="220" value="${escapeHtml(v.concepto||'')}" placeholder="Ej.: compra de cables, caché actuación…"></label><label class="control-label">Tercero / proveedor / cliente<input id="contaMovTercero" value="${escapeHtml(v.tercero||'')}"></label><label class="control-label">NIF / CIF<input id="contaMovNif" value="${escapeHtml(v.nif||'')}"></label><label class="control-label full">Notas<textarea id="contaMovNotas" rows="3">${escapeHtml(v.notas||'')}</textarea></label></div><div class="conta-upload-zone"><button class="btn-dark" type="button" onclick="document.getElementById('contaMovCamara').click()">📷 Fotografiar factura/ticket</button><button class="btn-light" type="button" onclick="document.getElementById('contaMovArchivos').click()">📎 Adjuntar archivos</button><input id="contaMovCamara" class="hidden" type="file" accept="image/*" capture="environment" onchange="staSeleccionarDocsMovimiento(this)"><input id="contaMovArchivos" class="hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onchange="staSeleccionarDocsMovimiento(this)"><div id="contaMovFilesPreview" class="conta-files-preview">${docs.length?`📁 ${docs.filter(d=>d.estado==='activo').length} documento(s) archivado(s).`: 'Puedes añadir varios documentos. Se archivarán al guardar.'}</div></div><label class="control-label">Tipo para los nuevos documentos<select id="contaMovDocTipo">${staTipoDocumentoOptions(v.tipo==='gasto'?'factura':'justificante_pago')}</select></label><div id="contaMovMsg" class="muted"></div><div class="conta-sheet-actions"><button class="btn-primary wide" type="button" onclick="guardarMovimientoContable()">💾 Guardar movimiento</button>${v.id?`<button class="btn-light" type="button" onclick="abrirDocumentosMovimiento(${Number(v.id)})">📁 Documentos (${docs.filter(d=>d.estado==='activo').length})</button><button class="btn-light" type="button" onclick="abrirAuditoriaContable('movimiento',${Number(v.id)})">🕘 Historial</button>${v.estado!=='anulado'?`<button class="btn-no wide" type="button" onclick="eliminarMovimientoContable(${Number(v.id)})">Anular movimiento</button>`:''}`:''}</div>`;
  abrirStaSheet(v.id?'Editar movimiento':(v.tipo==='ingreso'?'Nuevo ingreso':'Nuevo gasto'),html);
};
function staSeleccionarDocsMovimiento(input){const nuevos=Array.from(input?.files||[]);input.value='';staMovFilesPendientes.push(...nuevos);const b=document.getElementById('contaMovFilesPreview');if(b)b.innerHTML=staMovFilesPendientes.length?`Pendientes de archivar:<br>${staMovFilesPendientes.map(f=>`• ${escapeHtml(f.name)} (${(f.size/1024/1024).toFixed(2)} MB)`).join('<br>')}`:'Sin archivos nuevos.'}

guardarMovimientoContable=async function(){
  const msg=document.getElementById('contaMovMsg');const id=Number(document.getElementById('contaMovId')?.value||0)||null,fecha=document.getElementById('contaMovFecha')?.value||'',tipo=document.getElementById('contaMovTipo')?.value||'gasto',area=document.getElementById('contaMovArea')?.value||'general',eventoId=Number(document.getElementById('contaMovEvento')?.value||0)||null,categoria=document.getElementById('contaMovCategoria')?.value||'Otros',estado=document.getElementById('contaMovEstado')?.value||'registrado',concepto=document.getElementById('contaMovConcepto')?.value.trim()||'',tercero=document.getElementById('contaMovTercero')?.value.trim()||'',nif=document.getElementById('contaMovNif')?.value.trim()||'',importe=Number(document.getElementById('contaMovImporte')?.value||0),notas=document.getElementById('contaMovNotas')?.value.trim()||'',docTipo=document.getElementById('contaMovDocTipo')?.value||'otro';
  if(!fecha||!concepto||!Number.isFinite(importe)||importe<0){if(msg)msg.textContent='⚠️ Completa fecha, concepto e importe.';return}for(const f of staMovFilesPendientes){if(f.size>5*1024*1024){if(msg)msg.textContent=`⚠️ ${f.name} supera 5 MB.`;return}}
  if(msg)msg.textContent='Cifrando y guardando…';
  try{const {data,error}=await supabaseClient.rpc('guardar_movimiento_contable',{p_id:id,p_fecha:fecha,p_tipo:tipo,p_area:area,p_evento_id:eventoId,p_categoria:categoria,p_estado:estado,p_concepto:concepto,p_tercero:tercero||null,p_nif:nif||null,p_importe:importe,p_notas:notas||null,p_adjunto_nombre:null,p_adjunto_mime:null,p_adjunto_base64:null,p_eliminar_adjunto:false});if(error)throw error;const row=Array.isArray(data)?data[0]:data,movId=Number(row?.id||id);if(staMovFilesPendientes.length){if(msg)msg.textContent='Archivando documentos…';const meta={movimiento_id:movId,evento_id:eventoId,area,tipo_documento:docTipo,fecha_documento:fecha,numero:'',tercero,nif,base_imponible:null,iva_porcentaje:null,importe,forma_pago:'',notas};for(const f of staMovFilesPendientes)await staGuardarUnDocumento(f,meta,false)}staMovFilesPendientes=[];if(msg)msg.textContent='✅ Movimiento y documentación guardados.';await cargarContabilidad();setTimeout(()=>cerrarStaSheet(),350)}catch(e){console.error(e);if(msg)msg.textContent='❌ '+(e.message||'No se ha podido guardar.')}
};
eliminarMovimientoContable=async function(id){if(!confirm('¿Anular este movimiento? No se borrará: quedará en el historial y dejará de contar en el balance.'))return;const {error}=await supabaseClient.rpc('eliminar_movimiento_contable',{p_id:Number(id)});if(error){console.error(error);alert(error.message||'No se ha podido anular.');return}cerrarStaSheet();await cargarContabilidad()};

async function pintarExpedienteContable(){
  const box=document.getElementById('contaExpedienteContenido');if(!box)return;const val=document.getElementById('contaExpedienteEvento')?.value||'general',eventId=val==='general'?null:Number(val),movs=staContabilidadCache.filter(m=>eventId?Number(m.evento_id)===eventId:!m.evento_id),docs=staDocumentosContablesCache.filter(d=>eventId?Number(d.evento_id)===eventId:!d.evento_id),act=movs.filter(m=>m.estado!=='anulado'),ing=act.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+Number(m.importe||0),0),gas=act.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+Number(m.importe||0),0),faltan=act.filter(m=>!staDocsMovimiento(m.id).some(d=>d.estado==='activo')).length;
  let pres=0,facts=[];if(eventId){const [pr,fa]=await Promise.all([supabaseClient.rpc('obtener_presupuesto_evento',{p_evento_id:eventId}),supabaseClient.rpc('listar_facturas')]);if(!pr.error)pres=(pr.data||[]).length;if(!fa.error)facts=(fa.data||[]).filter(f=>Number(f.evento_id)===eventId)}
  const titulo=eventId?staContaEventoLabel(eventId):'Documentación general';box.innerHTML=`<div class="conta-exp-head"><h3>${eventId?'🎭':'📁'} ${escapeHtml(titulo)}</h3><div class="conta-exp-kpis"><div class="conta-exp-kpi"><span>Ingresos</span><strong>${escapeHtml(staContaEuros(ing))}</strong></div><div class="conta-exp-kpi"><span>Gastos</span><strong>${escapeHtml(staContaEuros(gas))}</strong></div><div class="conta-exp-kpi"><span>Resultado</span><strong>${escapeHtml(staContaEuros(ing-gas))}</strong></div></div></div><div class="conta-exp-checks">${eventId?`<div class="conta-exp-check"><strong>${pres?'✅':'—'} Presupuesto</strong><small>${pres?'Registrado en la app':'Sin presupuesto guardado'}</small></div><div class="conta-exp-check"><strong>${facts.length?'✅':'—'} Facturación</strong><small>${facts.length} factura(s) vinculada(s)</small></div>`:''}<div class="conta-exp-check"><strong>📎 ${docs.filter(d=>d.estado==='activo').length} documentos</strong><small>Archivo documental del expediente</small></div><div class="conta-exp-check"><strong>${faltan?'⚠️':'✅'} Justificantes</strong><small>${faltan?faltan+' movimiento(s) sin documento':'Todos los movimientos tienen documento'}</small></div></div><div class="conta-actions"><button class="btn-light" type="button" onclick="exportarPaqueteContable('expediente')">📦 Exportar expediente</button><button class="btn-primary" type="button" onclick="staAdjuntarDocumentoExpediente()">📎 Añadir documento</button></div><div class="conta-exp-section"><h4>💶 Movimientos</h4>${movs.length?`<div class="conta-list">${movs.map(m=>`<button class="conta-item ${m.tipo==='ingreso'?'ingreso':'gasto'} ${m.estado==='anulado'?'anulado':''}" onclick="abrirMovimientoContable(${Number(m.id)})"><span class="ico">${m.tipo==='ingreso'?'↗️':'↘️'}</span><span><strong>${escapeHtml(m.concepto)}</strong><small>${escapeHtml(formatearFechaCorta(m.fecha))} · ${escapeHtml(staContaAreaLabel(m.area))}</small></span><span class="amount">${escapeHtml(staContaEuros(m.importe))}</span></button>`).join('')}</div>`:'<div class="conta-empty">Sin movimientos.</div>'}</div><div class="conta-exp-section"><h4>📁 Documentos</h4>${docs.length?`<div class="conta-doc-list">${docs.map(d=>`<button class="conta-doc-item ${d.estado==='anulado'?'anulado':''}" onclick="abrirDocumentoContable(${Number(d.id)})"><span class="doc-ico">${staTipoDocumentoIcon(d.tipo_documento)}</span><span><strong>${escapeHtml(d.nombre)}</strong><small>${escapeHtml(staTipoDocumentoLabel(d.tipo_documento))} · ${escapeHtml(staContaAreaLabel(d.area))}</small></span><span class="doc-side">›</span></button>`).join('')}</div>`:'<div class="conta-empty">Sin documentos.</div>'}</div>`;
}

async function staCrearWorkbookContabilidad(rows,docs,titulo='Contabilidad'){
  await staCargarDependenciaExportar('ExcelJS');
  const wb=new ExcelJS.Workbook();wb.creator='Spirit to All';wb.created=new Date();
  wb.addWorksheet('Resumen anual',{properties:{tabColor:{argb:staExcelArgb(STA_XLSX.orange)}}});
  const ws=wb.addWorksheet('Movimientos');ws.views=[{state:'frozen',ySplit:1}];ws.columns=[{header:'Fecha',key:'fecha',width:13},{header:'Tipo',key:'tipo',width:11},{header:'Área',key:'area',width:18},{header:'Evento',key:'evento',width:32},{header:'Categoría',key:'categoria',width:24},{header:'Concepto',key:'concepto',width:42},{header:'Tercero',key:'tercero',width:28},{header:'NIF/CIF',key:'nif',width:18},{header:'Importe (€)',key:'importe',width:14},{header:'Estado',key:'estado',width:13},{header:'Notas',key:'notas',width:38},{header:'Documentos',key:'docs',width:12}];rows.forEach(m=>ws.addRow({fecha:m.fecha,tipo:m.tipo,area:staContaAreaLabel(m.area),evento:m.evento_id?staContaEventoLabel(m.evento_id):'General / sin evento',categoria:m.categoria,concepto:m.concepto,tercero:m.tercero||'',nif:m.nif||'',importe:Number(m.importe||0),estado:m.estado,notas:m.notas||'',docs:staDocsMovimiento(m.id).filter(d=>d.estado==='activo').length}));ws.getRow(1).font={bold:true};ws.autoFilter={from:'A1',to:'L1'};ws.getColumn('importe').numFmt='#,##0.00 "€"';
  const dw=wb.addWorksheet('Documentos');dw.columns=[{header:'Fecha',key:'fecha',width:13},{header:'Tipo',key:'tipo',width:22},{header:'Área',key:'area',width:18},{header:'Evento',key:'evento',width:34},{header:'Archivo',key:'nombre',width:38},{header:'Nº documento',key:'numero',width:20},{header:'Tercero',key:'tercero',width:28},{header:'NIF/CIF',key:'nif',width:18},{header:'Base (€)',key:'base',width:14},{header:'IVA (%)',key:'iva',width:11},{header:'Importe (€)',key:'importe',width:14},{header:'Forma de pago',key:'pago',width:20},{header:'Estado',key:'estado',width:12},{header:'Notas',key:'notas',width:36}];docs.forEach(d=>dw.addRow({fecha:d.fecha_documento,tipo:staTipoDocumentoLabel(d.tipo_documento),area:staContaAreaLabel(d.area),evento:d.evento_id?staContaEventoLabel(d.evento_id):'General',nombre:d.nombre,numero:d.numero||'',tercero:d.tercero||'',nif:d.nif||'',base:d.base_imponible==null?'':Number(d.base_imponible),iva:d.iva_porcentaje==null?'':Number(d.iva_porcentaje),importe:d.importe==null?'':Number(d.importe),pago:d.forma_pago||'',estado:d.estado,notas:d.notas||''}));dw.getRow(1).font={bold:true};dw.getColumn('importe').numFmt='#,##0.00 "€"';
  const ar=wb.addWorksheet('Resumen áreas');ar.columns=[{header:'Área',key:'area',width:22},{header:'Ingresos',key:'ing',width:16},{header:'Gastos',key:'gas',width:16},{header:'Balance',key:'bal',width:16}];for(const [k,v] of staResumenRows(rows,m=>m.area||'general'))ar.addRow({area:staContaAreaLabel(k),ing:v.ing,gas:v.gas,bal:v.ing-v.gas});ar.getRow(1).font={bold:true};['ing','gas','bal'].forEach(k=>ar.getColumn(k).numFmt='#,##0.00 "€"');
  const ev=wb.addWorksheet('Resumen eventos');ev.columns=[{header:'Evento',key:'evento',width:42},{header:'Ingresos',key:'ing',width:16},{header:'Gastos',key:'gas',width:16},{header:'Balance',key:'bal',width:16}];for(const [k,v] of staResumenRows(rows,m=>m.evento_id?String(m.evento_id):'general'))ev.addRow({evento:k==='general'?'General / sin evento':staContaEventoLabel(Number(k)),ing:v.ing,gas:v.gas,bal:v.ing-v.gas});ev.getRow(1).font={bold:true};['ing','gas','bal'].forEach(k=>ev.getColumn(k).numFmt='#,##0.00 "€"');
  staMejorarWorkbookContabilidad(wb,rows,docs,titulo);
  wb.subject=titulo;return wb;
}
function staMejorarWorkbookContabilidad(wb,rows,docs,titulo){
  const resumen=staResumenRows(rows,()=> 'total').get('total')||{ing:0,gas:0};
  const activos=rows.filter(m=>m.estado!=='anulado');
  const generado=new Date().toLocaleString('es-ES');
  const moneda='#,##0.00 "€"';
  const color=(hex)=>({argb:staExcelArgb(hex)});
  const dinero=(celda,valor,hex)=>{celda.value=Number(valor||0);celda.numFmt=moneda;celda.font={name:'Aptos',size:15,bold:true,color:color(hex)};celda.alignment={vertical:'middle'};};
  const dash=wb.getWorksheet('Resumen anual');
  staExcelConfigHoja(dash);dash.views=[{showGridLines:false}];
  staExcelTitulo(dash,'SPIRIT TO ALL · CONTABILIDAD',`${titulo} · Datos exportados: ${generado}`,'F');
  dash.mergeCells('A4:C4');dash.getCell('A4').value='INGRESOS';dash.mergeCells('D4:F4');dash.getCell('D4').value='GASTOS';
  dash.mergeCells('A5:C6');dash.mergeCells('D5:F6');dinero(dash.getCell('A5'),resumen.ing,STA_XLSX.greenText);dinero(dash.getCell('D5'),resumen.gas,STA_XLSX.redText);
  dash.mergeCells('A8:C8');dash.getCell('A8').value='RESULTADO · INGRESOS − GASTOS';dash.mergeCells('A9:C10');dinero(dash.getCell('A9'),resumen.ing-resumen.gas,STA_XLSX.black);
  dash.mergeCells('D8:F8');dash.getCell('D8').value='MOVIMIENTOS ACTIVOS / DOCUMENTOS';dash.mergeCells('D9:F10');dash.getCell('D9').value=`${activos.length} movimientos · ${docs.filter(d=>d.estado==='activo').length} documentos`;
  for(const addr of ['A4','D4','A8','D8']){const c=dash.getCell(addr);c.font={name:'Aptos',size:11,bold:true,color:color(STA_XLSX.white)};c.fill={type:'pattern',pattern:'solid',fgColor:color(STA_XLSX.black)};c.alignment={vertical:'middle',indent:1}}
  for(const addr of ['A5','D5','A9','D9']){const c=dash.getCell(addr);c.fill={type:'pattern',pattern:'solid',fgColor:color(STA_XLSX.orangeSoft)};c.alignment={vertical:'middle',indent:1}}
  dash.getCell('D9').font={name:'Aptos',size:13,bold:true,color:color(STA_XLSX.black)};
  dash.getRow(4).height=26;dash.getRow(8).height=26;[1,2,3,4,5,6].forEach(i=>dash.getColumn(i).width=17);
  dash.mergeCells('A12:F12');dash.getCell('A12').value='El balance excluye movimientos anulados. Los documentos se listan aparte y no se suman como gastos otra vez.';
  dash.getCell('A12').font={name:'Aptos',size:10,color:color(STA_XLSX.grayText)};

  const anio=String(titulo).match(/(?:Contabilidad[_ ]|año completo[^0-9]*)(\d{4})/)?.[1];
  const meses=anio?Array.from({length:12},(_,i)=>`${anio}-${String(i+1).padStart(2,'0')}`):[...new Set(rows.map(m=>String(m.fecha||'').slice(0,7)).filter(v=>/^\d{4}-\d{2}$/.test(v)))].sort();
  const porMes=staResumenRows(rows,m=>String(m.fecha||'').slice(0,7));
  const mesRows=meses.map(k=>{const v=porMes.get(k)||{ing:0,gas:0},[y,m]=k.split('-');return[`${staMesNombre(Number(m))} ${y}`,v.ing,v.gas,v.ing-v.gas,activos.filter(x=>String(x.fecha||'').startsWith(k)).length]});
  const mensual=staExcelTablaSimple(wb,'Por mes','SPIRIT TO ALL · EVOLUCIÓN MENSUAL',`${titulo} · Movimientos activos · ${generado}`,['Mes','Ingresos (€)','Gastos (€)','Resultado (€)','Movimientos'],mesRows,[24,21,21,22,18]);
  for(let i=5;i<5+mesRows.length;i++){for(const j of [2,3,4])mensual.getRow(i).getCell(j).numFmt=moneda;mensual.getRow(i).getCell(3).font={name:'Aptos',size:10,bold:true,color:color(STA_XLSX.redText)}}
  const ultimo=5+mesRows.length;const r=mensual.getRow(ultimo);r.values=['TOTAL',resumen.ing,resumen.gas,resumen.ing-resumen.gas,activos.length];
  for(let j=1;j<=5;j++){const c=r.getCell(j);c.font={name:'Aptos',bold:true,color:color(STA_XLSX.white)};c.fill={type:'pattern',pattern:'solid',fgColor:color(STA_XLSX.black)};if(j>=2&&j<=4)c.numFmt=moneda}r.height=27;
  const cats=staResumenRows(rows,m=>m.categoria||'Sin categoría');
  const categorias=[...cats.entries()].filter(([,v])=>v.gas>0).sort((a,b)=>b[1].gas-a[1].gas).map(([k,v])=>[k,v.gas,resumen.gas?v.gas/resumen.gas:0]);
  staExcelTablaSimple(wb,'Gastos por categoría','SPIRIT TO ALL · GASTOS POR CATEGORÍA',`${titulo} · Sin movimientos anulados`,['Categoría','Gastos (€)','% de los gastos'],categorias,[36,22,22],[2]).getColumn(2).numFmt=moneda;
  for(const nombre of ['Movimientos','Documentos','Resumen áreas','Resumen eventos']){
    const hoja=wb.getWorksheet(nombre);if(!hoja)continue;
    hoja.views=[{state:'frozen',ySplit:1,showGridLines:false}];hoja.getRow(1).height=27;staExcelCabecera(hoja.getRow(1));
    hoja.eachRow((fila,indice)=>{if(indice>1){staExcelFila(fila,indice);fila.height=23}});
    hoja.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,hoja.rowCount),column:hoja.columnCount}};
    for(const key of ['ing','gas','bal','importe','base']){const col=hoja.columns.find(c=>c.key===key);if(col)col.numFmt=moneda}
  }
  for(const i of [2,3,4])dash.getColumn(i).alignment={vertical:'middle'};
}
exportarContabilidadExcel=async function(filtrada=false){
  try{await staCargarDependenciaExportar('ExcelJS')}catch(e){alert(e.message);return}
  const y=Number(document.getElementById('contaFiltroAnio')?.value||new Date().getFullYear());
  const rows=filtrada?staContabilidadFiltrada():staContabilidadCache.filter(m=>Number(String(m.fecha||'').slice(0,4))===y);
  const ids=new Set(rows.map(m=>Number(m.id)));
  const docs=staDocumentosContablesCache.filter(d=>filtrada?ids.has(Number(d.movimiento_id)):Number(String(d.fecha_documento||d.creado_en||'').slice(0,4))===y);
  if(!rows.length&&!docs.length){alert('No hay información para exportar.');return}
  const alcance=filtrada?'vista filtrada':'año completo';
  const wb=await staCrearWorkbookContabilidad(rows,docs,`Contabilidad ${y} · ${alcance}`);
  const bytes=await wb.xlsx.writeBuffer();
  await staGuardarBlobCompatible(new Blob([bytes],{type:STA_XLSX_MIME}),`Contabilidad_Spirit_to_All_${y}${filtrada?'_filtrada':''}.xlsx`,{selectorArchivo:true});
};

async function exportarVistaContabilidad(){
  try{await staCargarDependenciaExportar('ExcelJS')}catch(e){alert(e.message||'No se pudo preparar Excel.');return}
  const vista=staContaVistaActual||'movimientos',wb=new ExcelJS.Workbook();wb.creator='Spirit to All';wb.created=new Date();
  let nombre='';let rows=[];let cols=[];
  if(vista==='movimientos'){
    rows=staContabilidadFiltrada();nombre='Movimientos visibles';
    cols=[['Fecha',m=>m.fecha,14],['Tipo',m=>m.tipo,13],['Área',m=>staContaAreaLabel(m.area),22],['Evento',m=>m.evento_id?staContaEventoLabel(m.evento_id):'General',42],['Categoría',m=>m.categoria,25],['Concepto',m=>m.concepto,40],['Tercero',m=>m.tercero||'',27],['Importe (€)',m=>Number(m.importe||0),17],['Estado',m=>m.estado,14],['Notas',m=>m.notas||'',35]];
  }else if(vista==='documentos'){
    rows=staDocFiltrados();nombre='Documentos visibles';
    cols=[['Fecha',d=>d.fecha_documento||'',14],['Tipo',d=>staTipoDocumentoLabel(d.tipo_documento),23],['Área',d=>staContaAreaLabel(d.area),22],['Evento',d=>d.evento_id?staContaEventoLabel(d.evento_id):'General',42],['Archivo',d=>d.nombre||'',40],['Nº documento',d=>d.numero||'',20],['Tercero',d=>d.tercero||'',26],['Importe (€)',d=>d.importe==null?'':Number(d.importe),17],['Estado',d=>d.estado,14]];
  }else{
    const sel=document.getElementById('contaExpedienteEvento')?.value||'general',id=sel==='general'?null:Number(sel);
    const same=x=>id?Number(x.evento_id)===id:!x.evento_id;
    const movs=staContabilidadCache.filter(same),docs=staDocumentosContablesCache.filter(same);
    if(!movs.length&&!docs.length){alert('Este expediente no contiene datos.');return}
    const sheet=wb.addWorksheet('Movimientos');sheet.columns=[{header:'Fecha',key:'fecha',width:15},{header:'Concepto',key:'concepto',width:42},{header:'Tipo',key:'tipo',width:15},{header:'Importe (€)',key:'importe',width:18},{header:'Estado',key:'estado',width:16}];movs.forEach(m=>sheet.addRow({fecha:m.fecha,concepto:m.concepto,tipo:m.tipo,importe:Number(m.importe||0),estado:m.estado}));
    const ds=wb.addWorksheet('Documentos');ds.columns=[{header:'Fecha',key:'fecha',width:15},{header:'Archivo',key:'archivo',width:45},{header:'Tipo',key:'tipo',width:23},{header:'Importe (€)',key:'importe',width:18},{header:'Estado',key:'estado',width:16}];docs.forEach(d=>ds.addRow({fecha:d.fecha_documento,archivo:d.nombre,tipo:staTipoDocumentoLabel(d.tipo_documento),importe:d.importe==null?'':Number(d.importe),estado:d.estado}));
    nombre='Expediente visible';
  }
  if(vista!=='expedientes'){
    if(!rows.length){alert('No hay datos en la vista actual.');return}
    const sheet=wb.addWorksheet(nombre);sheet.columns=cols.map(([header,,width],i)=>({header,key:'c'+i,width}));rows.forEach(x=>sheet.addRow(Object.fromEntries(cols.map(([,fn],i)=>['c'+i,fn(x)]))));
  }
  wb.eachSheet(sheet=>{sheet.views=[{state:'frozen',ySplit:1,showGridLines:false}];staExcelCabecera(sheet.getRow(1));sheet.autoFilter={from:'A1',to:sheet.getColumn(sheet.columnCount).letter+'1'};sheet.eachRow((row,i)=>{if(i>1)staExcelFila(row,i)});const money=sheet.columns.find(c=>c.header==='Importe (€)');if(money)money.numFmt='#,##0.00 "€"'});
  const bytes=await wb.xlsx.writeBuffer();await staGuardarBlobCompatible(new Blob([bytes],{type:STA_XLSX_MIME}),`Spirit_${staSanitizeFileName(nombre)}.xlsx`,{selectorArchivo:true});
}

async function exportarPaqueteContable(tipo='anual'){
  try{await Promise.all(['JSZip','ExcelJS'].map(staCargarDependenciaExportar))}catch(e){alert(e.message);return}
  let rows=[],docs=[],nombre='';
  if(tipo==='expediente'){const val=document.getElementById('contaExpedienteEvento')?.value||'general',id=val==='general'?null:Number(val);rows=staContabilidadCache.filter(m=>id?Number(m.evento_id)===id:!m.evento_id);docs=staDocumentosContablesCache.filter(d=>(id?Number(d.evento_id)===id:!d.evento_id)&&d.estado==='activo');nombre=id?`Expediente_${staSanitizeFileName((eventosActuales||[]).find(e=>Number(e.id)===id)?.titulo||id)}`:'Documentacion_general'}else{const y=Number(document.getElementById('contaFiltroAnio')?.value||new Date().getFullYear());rows=staContabilidadCache.filter(m=>Number(String(m.fecha||'').slice(0,4))===y);docs=staDocumentosContablesCache.filter(d=>Number(String(d.fecha_documento||d.creado_en||'').slice(0,4))===y&&d.estado==='activo');nombre=`Contabilidad_${y}`}
  if(!rows.length&&!docs.length){alert('No hay información para exportar.');return}const zip=new JSZip(),wb=await staCrearWorkbookContabilidad(rows,docs,nombre),xlsx=await wb.xlsx.writeBuffer();zip.file('Resumen_contable.xlsx',xlsx);zip.file('LEEME.txt',`Spirit to All · ${nombre}\nMovimientos: ${rows.length}\nDocumentos activos: ${docs.length}\nGenerado: ${new Date().toLocaleString('es-ES')}\n`);
  for(let i=0;i<docs.length;i++){const d=docs[i],res=await supabaseClient.rpc('obtener_documento_contable',{p_id:Number(d.id)});if(res.error)continue;const f=Array.isArray(res.data)?res.data[0]:res.data;if(!f?.contenido_base64)continue;const folder=d.evento_id?`Eventos/${staSanitizeFileName((eventosActuales||[]).find(e=>Number(e.id)===Number(d.evento_id))?.titulo||d.evento_id)}`:'General';zip.file(`${folder}/${String(i+1).padStart(3,'0')}_${staSanitizeFileName(f.nombre||'documento')}`,staBytesDesdeBase64(f.contenido_base64))}
  const blob=await zip.generateAsync({type:'blob'});await staGuardarBlobCompatible(blob,`${staSanitizeFileName(nombre)}.zip`,{selectorArchivo:true});
}

staAbrirGastoAreaProduccion=function(areaId){if(!staPuedeEditarAreaProduccion(areaId))return;const eventoId=Number(staProduccionEventoId||0)||null;cerrarStaSheet();abrirContabilidadDirecto();setTimeout(()=>abrirMovimientoContable(null,'gasto',areaId,eventoId),220)};

async function abrirHistorialPresupuestoActual(){const id=Number(presupuestoActual?.id||0);if(!id){alert('Guarda primero el presupuesto.');return}await abrirAuditoriaContable('presupuesto',id)}
async function abrirHistorialFacturaActual(){const id=Number(document.getElementById('facturaId')?.value||0);if(!id){alert('Guarda primero la factura.');return}await abrirAuditoriaContable('factura',id)}
eliminarPresupuestoActual=async function(){const id=Number(presupuestoActual?.id||0);if(!id||!confirm('¿Anular este presupuesto? No se borrará: quedará registrado en el historial.'))return;const {error}=await supabaseClient.rpc('eliminar_presupuesto',{p_id:id});if(error){console.error(error);alert('No se ha podido anular el presupuesto. '+(error.message||''));return}presupuestoActual.estado='anulado';document.getElementById('presupuestoEstado').value='anulado';pintarEstadoPresupuesto();alert('Presupuesto anulado. Se conserva en el historial.')};
eliminarFacturaActual=async function(){const id=Number(document.getElementById('facturaId')?.value||0);if(!id||!confirm('¿Anular esta factura? No se borrará: quedará registrada en el historial.'))return;const {error}=await supabaseClient.rpc('eliminar_factura',{p_id:id});if(error){console.error(error);alert('No se ha podido anular la factura. '+(error.message||''));return}document.getElementById('facturaEstado').value='anulada';await cargarFacturas();alert('Factura anulada. Se conserva en el historial.')};
