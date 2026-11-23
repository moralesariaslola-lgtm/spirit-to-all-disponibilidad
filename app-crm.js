// =========================================================

// Orden persistente compartido: listas de clientes, bolos y producción.
const staOrdenModo={clientes:false,bolos:false,produccion:false};
const staOrdenPosiciones={clientes:new Map(),bolos:new Map(),produccion:new Map()};
let staOrdenSeleccionado=null,staOrdenDrag=null,staOrdenGuardando=false,staOrdenFinArrastre=0;
async function staOrdenCargar(){
 try{const {data,error}=await supabaseClient.rpc('sta_orden_leer');if(error)throw error;
  for(const t of ['clientes','bolos','produccion'])staOrdenPosiciones[t].clear();
  for(const row of data||[])if(staOrdenPosiciones[row.tipo])staOrdenPosiciones[row.tipo].set(Number(row.elemento_id),Number(row.posicion));
 }catch(e){console.warn('Orden personalizado no disponible',e)}
}
function staOrdenAplicar(items,tipo){const map=staOrdenPosiciones[tipo];if(!map)return items.slice();return items.slice().sort((a,b)=>(map.get(Number(a.id))??999999)-(map.get(Number(b.id))??999999));}
function staOrdenAlternar(tipo){
 if(staOrdenGuardando||!staOrdenModo.hasOwnProperty(tipo))return;
 const filtrado=tipo==='produccion'?(staProduccionBusqueda.trim()||staProduccionFiltro):(staCrmBusqueda.trim()||(tipo==='bolos'&&staCrmFiltroEstado));
 if(!staOrdenModo[tipo]&&filtrado){alert('Para editar el orden manual, limpia primero la búsqueda y selecciona Todos los estados.');return}
 if(staOrdenModo[tipo]&&tipo!=='clientes')staOrdenVistaBolos[tipo]='manual';
 staOrdenModo[tipo]=!staOrdenModo[tipo];staOrdenSeleccionado=null;
 if(staOrdenModo[tipo]){if(tipo==='produccion'){staProduccionBusqueda='';staProduccionFiltro='';}else{staCrmBusqueda='';staCrmFiltroEstado='';}}
 if(tipo==='produccion')staProduccionRenderLista();else{const el=document.getElementById('staSheetBody');if(el){el.innerHTML=staCrmHubHtml();staOrdenDecorar('crm');staCrmFiltrarLista()}}
}
function staOrdenDecorar(vista){
 const tipo=vista==='produccion'?'produccion':staCrmVista==='clientes'?'clientes':'bolos';
 const container=document.getElementById(vista==='produccion'?'staProdOppListado':'staCrmTarjetas');if(!container)return;
 if(!staOrdenModo[tipo])return;
 container.querySelectorAll('[data-orden-id]').forEach(card=>{
  const wrap=document.createElement('div');wrap.className='sta-sort-wrap';wrap.dataset.ordenId=card.dataset.ordenId;
  const handle=document.createElement('button');handle.type='button';handle.className='sta-sort-handle';handle.textContent='⠿';
  handle.setAttribute('aria-label','Mover '+(card.querySelector('strong')?.textContent||'elemento'));handle.title='Mantén pulsado para arrastrar o toca dos elementos para moverlos';
  handle.addEventListener('pointerdown',staOrdenPointerDown);
  wrap.addEventListener('click',e=>{if(Date.now()-staOrdenFinArrastre<600)return;staOrdenTocar(wrap,tipo)});
  wrap.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const d=e.key==='ArrowUp'?-1:1;const vecino=d<0?wrap.previousElementSibling:wrap.nextElementSibling;if(!vecino?.dataset.ordenId)return;const prev=[...container.querySelectorAll(':scope > .sta-sort-wrap')].map(x=>Number(x.dataset.ordenId));container.insertBefore(wrap,d<0?vecino:vecino.nextElementSibling);void staOrdenGuardar(tipo,container,prev)});
  card.disabled=true;card.setAttribute('aria-hidden','true');
  card.parentElement.insertBefore(wrap,card);wrap.appendChild(handle);wrap.appendChild(card);
 });
}
function staOrdenTocar(wrap,tipo){
 const container=wrap.parentElement;
 if(!staOrdenSeleccionado||staOrdenSeleccionado.tipo!==tipo){
  container.querySelectorAll('.sta-sort-selected').forEach(x=>x.classList.remove('sta-sort-selected'));
  staOrdenSeleccionado={tipo,wrap};wrap.classList.add('sta-sort-selected');return;
 }
 const picked=staOrdenSeleccionado.wrap;staOrdenSeleccionado=null;
 container.querySelectorAll('.sta-sort-selected').forEach(x=>x.classList.remove('sta-sort-selected'));
 if(!picked.isConnected||picked===wrap)return;
 const antes=[...container.querySelectorAll(':scope > .sta-sort-wrap')].map(x=>Number(x.dataset.ordenId));
 container.insertBefore(picked,wrap);void staOrdenGuardar(tipo,container,antes);
}
function staOrdenPointerDown(ev){
 if(staOrdenGuardando||staOrdenDrag||ev.button!==0)return;
 const handle=ev.currentTarget,wrap=handle.closest('.sta-sort-wrap'),container=wrap?.parentElement;
 if(!wrap||!container)return;
 ev.preventDefault();try{handle.setPointerCapture(ev.pointerId)}catch(e){}
 staOrdenDrag={handle,wrap,container,pointerId:ev.pointerId,antes:[...container.querySelectorAll(':scope > .sta-sort-wrap')].map(x=>Number(x.dataset.ordenId)),startY:ev.clientY,moved:false};
 document.addEventListener('pointermove',staOrdenPointerMove,{passive:false});document.addEventListener('pointerup',staOrdenPointerUp);document.addEventListener('pointercancel',staOrdenPointerCancel);
 wrap.classList.add('sta-sort-dragging');
}
function staOrdenPointerMove(ev){const d=staOrdenDrag;if(!d||d.pointerId!==ev.pointerId)return;
 ev.preventDefault();if(Math.abs(ev.clientY-d.startY)>7)d.moved=true;
 const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.sta-sort-wrap');
 if(target&&target!==d.wrap&&target.parentElement===d.container){const rect=target.getBoundingClientRect();d.container.insertBefore(d.wrap,ev.clientY<rect.top+rect.height/2?target:target.nextElementSibling);d.moved=true;}
 const sc=document.getElementById('staSheetBody');if(sc){const r=sc.getBoundingClientRect();if(ev.clientY<r.top+55)sc.scrollTop-=14;else if(ev.clientY>r.bottom-55)sc.scrollTop+=14;}
}
function staOrdenPointerFin(){const d=staOrdenDrag;staOrdenDrag=null;document.removeEventListener('pointermove',staOrdenPointerMove);document.removeEventListener('pointerup',staOrdenPointerUp);document.removeEventListener('pointercancel',staOrdenPointerCancel);if(d)d.wrap.classList.remove('sta-sort-dragging');return d;}
function staOrdenPointerUp(ev){if(!staOrdenDrag||ev.pointerId!==staOrdenDrag.pointerId)return;ev.preventDefault();const d=staOrdenPointerFin();if(!d)return;
 staOrdenFinArrastre=Date.now();
 if(d.moved){const tipo=d.container.id==='staProdOppListado'?'produccion':staCrmVista==='clientes'?'clientes':'bolos';void staOrdenGuardar(tipo,d.container,d.antes)}
 else staOrdenTocar(d.wrap,d.container.id==='staProdOppListado'?'produccion':staCrmVista==='clientes'?'clientes':'bolos');
}
function staOrdenPointerCancel(ev){if(staOrdenDrag?.pointerId===ev.pointerId){staOrdenPointerFin();const tipo=document.getElementById('staProdOppListado')?'produccion':staCrmVista==='clientes'?'clientes':'bolos';staOrdenRender(tipo)}}
function staOrdenRender(tipo){if(tipo==='produccion')staProduccionRenderLista();else{const body=document.getElementById('staSheetBody');if(body){body.innerHTML=staCrmHubHtml();staOrdenDecorar('crm');staCrmFiltrarLista()}}}
async function staOrdenGuardar(tipo,container,antes){
 const ids=[...container.querySelectorAll(':scope > .sta-sort-wrap')].map(x=>Number(x.dataset.ordenId));
 if(ids.length===antes.length&&ids.every((x,i)=>x===antes[i]))return;
 if(staOrdenGuardando)return;
 staOrdenGuardando=true;
 try{
  const {error}=await supabaseClient.rpc('sta_orden_guardar',{p_tipo:tipo,p_ids:ids});if(error)throw error;
  const map=staOrdenPosiciones[tipo];map.clear();ids.forEach((id,i)=>map.set(id,i+1));
 }catch(e){console.error('No se ha podido guardar el orden',e);alert('No se ha podido guardar el orden. '+(e.message||'Inténtalo de nuevo.'));
  try{await staOrdenCargar()}catch(_){}
 }finally{staOrdenGuardando=false;if(container.isConnected)staOrdenRender(tipo)}
}

// CRM · CLIENTES / OPORTUNIDADES + PRODUCCIÓN PRE-ENCUESTA
// Build 2026-10-22-2355
// =========================================================
let staCrmClientes=[],staCrmOportunidades=[],staCrmVista='oportunidades';
let staProdOppId=null,staProdOppFicha=null,staProdOppTareas=[],staProdOppLog=null,staProdOppArea='comercial',staProdOppLogTab='tecnica';
const STA_CRM_ESTADOS={nuevo:'Pendiente de contactar',contactado:'Contactado',en_conversacion:'En conversaciones',clarificar_encargo:'Clarificar el encargo',pendiente_viabilidad:'Fecha definida · pendiente de viabilidad',pendiente_encuesta:'Pendiente de encuesta',encuesta_en_curso:'Encuesta en curso',preparando_propuesta:'Preparando propuesta',propuesta_enviada:'Propuesta enviada',pendiente_respuesta:'Pendiente de respuesta',confirmado:'Confirmado',finalizado:'Finalizado / realizado',facturado:'Facturado',cobrado:'Cobrado',cerrado:'Cerrado / archivado',perdido:'No contratado',descartado:'Descartado'};
function staCrmEstadoLabel(v){return STA_CRM_ESTADOS[v]||v||'Nuevo'}
function staCrmEstadoClase(v){return ['confirmado','finalizado','facturado','cobrado','cerrado'].includes(v)?'ok':(['perdido','descartado'].includes(v)?'muted':'')}
function staCrmEuros(v){return v==null||v===''?'—':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v)||0)}
function staCrmModalidadLabel(v){return ({lucrativo:'Lucrativo',solidario:'Solidario',con_coste:'Con coste (pagamos nosotros)',sin_definir:'Por definir'})[v]||'Por definir'}
function staCrmResumenEconomico(o){if(o.modalidad_bolo==='solidario')return o.aportacion_tecnico!=null?'Solidario · Técnico: '+staCrmEuros(o.aportacion_tecnico):'Solidario · Técnico pendiente';if(o.modalidad_bolo==='lucrativo')return 'Lucrativo · '+staCrmEuros(o.cache_estimado);if(o.modalidad_bolo==='con_coste')return o.coste_bolo!=null?'Con coste · Pagamos: '+staCrmEuros(o.coste_bolo):'Con coste · Importe pendiente';return o.cache_estimado!=null?'Por definir · '+staCrmEuros(o.cache_estimado):'Tipo por definir'}
function staCrmActualizarModalidad(){const m=document.getElementById('crmOppModalidad')?.value||'',c=document.getElementById('crmOppCacheCampo'),t=document.getElementById('crmOppTecnicoCampo'),g=document.getElementById('crmOppCosteCampos'),a=document.getElementById('crmOppModalidadAyuda');if(c)c.classList.toggle('hidden',m!=='lucrativo');if(t)t.classList.toggle('hidden',m!=='solidario');if(g)g.classList.toggle('hidden',m!=='con_coste');if(a)a.textContent=m==='solidario'?'Actuación solidaria: puedes registrar una aportación para técnico/sonido sin considerarla caché del coro.':m==='lucrativo'?'Caché estimado o acordado que recibirá el coro. El presupuesto y la factura se gestionan aparte.':m==='con_coste'?'En este concierto Spirit to All paga (por ejemplo, a la parroquia por el espacio de ensayos o la cuota de un festival). Anota el coste previsto; para los pagos reales utiliza Economía.':'Selecciona el tipo de bolo. Los registros antiguos conservarán sus importes hasta que los clasifiques.'} 
function staCrmCliente(id){return staCrmClientes.find(x=>Number(x.id)===Number(id))}
function staCrmOportunidad(id){return staCrmOportunidades.find(x=>Number(x.id)===Number(id))}
async function staCrmCargar(){
  await staCargarUsuariosParaTareas();
  await staEquipoCargar();
  if(!staTienePermiso('comercial')){
    const {data,error}=await supabaseClient.rpc('sta_bolos_produccion');
    if(error)throw error;
    staCrmClientes=[];staCrmOportunidades=data||[];
    await staOrdenCargar();
    return;
  }
  const [c,o]=await Promise.all([supabaseClient.rpc('crm_listar_clientes',{p_busqueda:null,p_incluir_archivados:true}),supabaseClient.rpc('crm_listar_bolos_con_coste',{p_cliente_id:null,p_estado:null})]);
  if(c.error)throw c.error;if(o.error)throw o.error;staCrmClientes=c.data||[];staCrmOportunidades=o.data||[];await staOrdenCargar();
}
const STA_CRM_ESTADOS_ARCHIVADOS=['finalizado','facturado','cobrado','cerrado'];
const STA_CRM_ESTADOS_CERRADOS=['confirmado',...STA_CRM_ESTADOS_ARCHIVADOS,'perdido','descartado'];
function staCrmResumen(){
 const activas=staCrmOportunidades.filter(o=>!STA_CRM_ESTADOS_CERRADOS.includes(o.estado)).length;
 const confirmadas=staCrmOportunidades.filter(o=>o.estado==='confirmado').length;
 const cerradas=staCrmOportunidades.filter(o=>STA_CRM_ESTADOS_ARCHIVADOS.includes(o.estado)).length;
 const kpi=(clase,etiqueta,numero,accion,activo)=>`<button type="button" class="sta-crm-kpi sta-crm-kpi-accion sta-list-shortcut${activo?' is-active':''}" onclick="staCrmAbrirResumen('${accion}')" aria-pressed="${Boolean(activo)}" aria-label="Ver ${etiqueta.toLowerCase()}: ${numero}"><strong>${numero}</strong><small>${etiqueta}</small></button>`;
 return `<div class="sta-crm-kpis sta-list-shortcuts" role="group" aria-label="Accesos rápidos a los listados comerciales">${kpi('clientes','Clientes activos',staCrmClientes.filter(c=>c.activo).length,'clientes',staCrmVista==='clientes')}${kpi('negociacion','Bolos en negociación',activas,'negociacion',staCrmVista==='oportunidades'&&staCrmFiltroEstado==='__negociacion')}${kpi('confirmados','Bolos confirmados',confirmadas,'confirmados',staCrmVista==='oportunidades'&&staCrmFiltroEstado==='confirmado')}${kpi('cerrados','Bolos cerrados',cerradas,'cerrados',staCrmVista==='oportunidades'&&staCrmFiltroEstado==='__cerrados')}</div>`;
}
function staCrmAbrirResumen(tipo){
 if(!['clientes','negociacion','confirmados','cerrados'].includes(tipo))return;
 const vista=tipo==='clientes'?'clientes':'oportunidades';
 const orden=tipo==='clientes'?'clientes':'bolos';
 if(staOrdenModo[orden])staOrdenModo[orden]=false;
 staOrdenSeleccionado=null;
 staCrmVista=vista;
 staCrmBusqueda='';
 staCrmFiltroEstado=tipo==='negociacion'?'__negociacion':tipo==='confirmados'?'confirmado':tipo==='cerrados'?'__cerrados':'';
 const body=document.getElementById('staSheetBody');if(!body)return;
 body.innerHTML=staCrmHubHtml();staOrdenDecorar('crm');staCrmFiltrarLista();
 body.querySelector('.sta-crm-browser')?.scrollIntoView({behavior:'smooth',block:'start'});
}
let staCrmBusqueda='',staCrmFiltroEstado='confirmado';
function staCrmNormalizar(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
const staOrdenVistaBolos={bolos:'fecha',produccion:'fecha'};
function staBoloCoincideEstado(estado,filtro){
 if(!filtro)return true;
 if(filtro==='__negociacion')return !STA_CRM_ESTADOS_CERRADOS.includes(estado);
 if(filtro==='__cerrados')return STA_CRM_ESTADOS_ARCHIVADOS.includes(estado);
 return estado===filtro;
}
function staBolosOrdenados(lista,tipo){
 const manual=staOrdenAplicar(lista,tipo);
 const criterio=staOrdenVistaBolos[tipo];
 if(staOrdenModo[tipo]||criterio==='manual')return manual;
 return [...manual].sort((a,b)=>{
  if(criterio==='nombre')return String(a.titulo||'').localeCompare(String(b.titulo||''),'es',{sensitivity:'base'});
  if(!a.fecha_prevista||!b.fecha_prevista)return Number(!a.fecha_prevista)-Number(!b.fecha_prevista);
  const fecha=String(a.fecha_prevista).localeCompare(String(b.fecha_prevista));
  if(fecha)return criterio==='recientes'?-fecha:fecha;
  if(!a.hora_prevista||!b.hora_prevista)return Number(!a.hora_prevista)-Number(!b.hora_prevista);
  const hora=String(a.hora_prevista).localeCompare(String(b.hora_prevista));
  return criterio==='recientes'?-hora:hora;
 });
}
function staCambiarOrdenBolos(tipo,valor){
 staOrdenVistaBolos[tipo]=valor;
 if(tipo==='produccion'){staProduccionRenderLista();document.getElementById('staOrdenVista-produccion')?.focus();return}
 document.getElementById('staSheetBody').innerHTML=staCrmHubHtml();
 staCrmFiltrarLista();
 document.getElementById('staOrdenVista-bolos')?.focus();
}
function staOpcionesEstadoBolos(filtro,produccion=false){
 const estados=Object.entries(STA_CRM_ESTADOS).filter(([id])=>id!=='confirmado'&&(!produccion||!['perdido','descartado'].includes(id)));
 const opciones=[['','Todos los estados'],['confirmado','Confirmados'],['__cerrados','Cerrados (todos)'],...(produccion?[]:[['__negociacion','En negociación']]),...estados];
 return opciones.map(([id,label])=>`<option value="${escapeHtml(id)}" ${id===filtro?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function staSelectorOrdenBolos(tipo,bloqueado){
 return `<label class="sta-list-control"><span>Ordenar por</span><select id="staOrdenVista-${tipo}" onchange="staCambiarOrdenBolos('${tipo}',this.value)" ${bloqueado?'disabled':''}>${[['fecha','Fecha y hora'],['recientes','Más recientes'],['nombre','Nombre A–Z'],['manual','Orden guardado']].map(([id,label])=>`<option value="${id}" ${staOrdenVistaBolos[tipo]===id?'selected':''}>${label}</option>`).join('')}</select></label>`;
}
function staBoloFichaLista(o,tipo){
 const produccion=tipo==='produccion';
 const fecha=o.fecha_prevista?formatearFechaCorta(o.fecha_prevista):'Fecha pendiente';
 const hora=staFmtHora(o.hora_prevista);
 const estado=staCrmEstadoLabel(o.estado);
 return `<button type="button" class="sta-crm-ficha sta-bolo-list-card ${produccion?'sta-produccion-card':''}" data-orden-id="${Number(o.id)}" data-estado="${escapeHtml(o.estado||'')}" data-filtro="${escapeHtml([o.titulo,o.cliente_nombre,o.responsable,estado,o.lugar,fecha,hora||'Hora por confirmar'].join(' '))}" onclick="staCrmVistaRapida(${Number(o.id)},${produccion})">
 <span class="sta-bolo-when">
 ${o.fecha_prevista?`<time datetime="${escapeHtml(o.fecha_prevista)}">${escapeHtml(fecha)}</time>`:'<span>Sin fecha</span>'}
 ${hora?`<b>${escapeHtml(hora)}</b>`:'<span class="sta-bolo-no-time"><span>Hora por</span> <span>confirmar</span></span>'}
 </span>
 <span class="sta-bolo-title"><strong>${escapeHtml(o.titulo||'Bolo')}</strong><span class="sta-crm-badge ${staCrmEstadoClase(o.estado)}">${escapeHtml(estado)}</span></span>
 <span class="sta-bolo-person"><small>Responsable</small><b>${escapeHtml(o.responsable||'Sin asignar')}</b></span>
 <span class="sta-bolo-eye"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg><span>Ver resumen</span></span>
 </button>`;
}
function staCrmFiltrarLista(){
 const input=document.getElementById('staCrmBuscar'),estado=document.getElementById('staCrmFilEstado');
 if(input)staCrmBusqueda=input.value;if(estado)staCrmFiltroEstado=estado.value;
 let visibles=0;
 document.querySelectorAll('#staCrmTarjetas .sta-crm-ficha').forEach(card=>{
  const coincide=staCrmNormalizar(card.dataset.filtro||'').includes(staCrmNormalizar(staCrmBusqueda.trim()));
  const valorEstado=card.dataset.estado||'';
  const coincideEstado=staCrmVista!=='oportunidades'||staBoloCoincideEstado(valorEstado,staCrmFiltroEstado);
  card.hidden=!(coincide&&coincideEstado);if(card.parentElement?.classList.contains('sta-sort-wrap'))card.parentElement.hidden=card.hidden;if(!card.hidden)visibles++;
 });
 const vacio=document.getElementById('staCrmSinResultados');if(vacio)vacio.hidden=visibles>0||!document.querySelector('#staCrmTarjetas .sta-crm-ficha');
}
function staCrmHubHtml(){
 const clientes=staOrdenAplicar(staCrmClientes.filter(c=>c.activo),'clientes');
 const opps=staBolosOrdenados(staCrmOportunidades,'bolos');
 const listaOpp=opps.length?opps.map(o=>staBoloFichaLista(o,'bolos')).join(''):'<div class="sta-crm-empty">Todavía no hay bolos.</div>';
 const listaCli=clientes.length?clientes.map(c=>`<button class="sta-crm-ficha sta-crm-ficha-cliente" type="button" data-orden-id="${Number(c.id)}" data-filtro="${escapeHtml([c.nombre,c.razon_social,c.nif,c.contacto_nombre].join(' '))}" onclick="staCrmAbrirCliente(${Number(c.id)})"><span class="sta-crm-ficha-header"><strong>${escapeHtml(c.nombre)}</strong><span class="sta-crm-badge muted">${Number(c.oportunidades||0)} bolo${Number(c.oportunidades||0)===1?'':'s'}</span></span><span class="sta-crm-ficha-sub">${escapeHtml(c.razon_social||'Cliente registrado')}</span><span class="sta-crm-ficha-next"><b>Ver ficha</b> · Contactos, datos y bolos <span aria-hidden="true">›</span></span></button>`).join(''):'<div class="sta-crm-empty">Todavía no hay clientes.</div>';
 return `<section class="sta-crm-overview" aria-label="Panel comercial">${staCrmResumen()}<div class="sta-crm-quick-actions"><button class="sta-crm-add sta-crm-add-primary" type="button" onclick="staCrmEditarCliente(null)">＋ Nuevo cliente</button><button class="sta-crm-add sta-crm-add-dark" type="button" onclick="staCrmEditarOportunidad(null,null)">＋ Nuevo bolo</button></div></section>
 <section class="sta-crm-browser" aria-label="Explorar clientes y bolos"><div class="sta-crm-switch" role="tablist" aria-label="Ver clientes o bolos"><button id="staTabBolos" role="tab" aria-controls="staCrmTarjetas" aria-selected="${staCrmVista==='oportunidades'}" class="${staCrmVista==='oportunidades'?'active':''}" type="button" onclick="staCrmCambiarVista('oportunidades')">Bolos</button><button id="staTabClientes" role="tab" aria-controls="staCrmTarjetas" aria-selected="${staCrmVista==='clientes'}" class="${staCrmVista==='clientes'?'active':''}" type="button" onclick="staCrmCambiarVista('clientes')">Clientes</button></div>
 <div class="sta-crm-search-row"><label class="sta-list-control"><span>Buscar ${staCrmVista==='oportunidades'?'bolos':'clientes'}</span><input id="staCrmBuscar" aria-label="Buscar ${staCrmVista==='oportunidades'?'bolos':'clientes'}" type="search" placeholder="Buscar ${staCrmVista==='oportunidades'?'bolo, cliente, responsable…':'cliente…'}" value="${escapeHtml(staCrmBusqueda)}" oninput="staCrmFiltrarLista()" autocomplete="off" ${staOrdenModo[staCrmVista==='oportunidades'?'bolos':'clientes']?'disabled':''}></label>${staCrmVista==='oportunidades'?`<label class="sta-list-control"><span>Estado</span><select id="staCrmFilEstado" onchange="staCrmFiltrarLista()" ${staOrdenModo.bolos?'disabled':''}>${staOpcionesEstadoBolos(staCrmFiltroEstado)}</select></label>${staSelectorOrdenBolos('bolos',staOrdenModo.bolos)}`:''}</div>
 <div class="sta-sort-toolbar"><span class="sta-sort-help">${staOrdenModo[staCrmVista==='oportunidades'?'bolos':'clientes']?'Toca una ficha y después su destino, o arrastra el símbolo ⠿. Se guarda automáticamente.':''}</span><div class="sta-sort-actions"><button class="sta-sort-btn" type="button" aria-pressed="${Boolean(staOrdenModo[staCrmVista==='oportunidades'?'bolos':'clientes'])}" onclick="staOrdenAlternar('${staCrmVista==='oportunidades'?'bolos':'clientes'}')">${staOrdenModo[staCrmVista==='oportunidades'?'bolos':'clientes']?'✓ Listo':'⠿ Editar orden manual'}</button></div></div>
 <div id="staCrmTarjetas" class="sta-crm-fichas">${staCrmVista==='oportunidades'?listaOpp:listaCli}</div><p id="staCrmSinResultados" class="sta-crm-empty" hidden>No hay bolos o clientes que coincidan con los filtros.</p></section>`;
}
async function abrirCrmComercial(){if(!staTienePermiso('comercial'))return;abrirStaSheet('Clientes y bolos','<div class="sta-sheet-intro"><strong>Cargando CRM…</strong></div>');const body=document.getElementById('staSheetBody'),carga=body.firstElementChild;try{await staCrmCargar();if(document.getElementById('staSheetBackdrop').classList.contains('hidden')||body.firstElementChild!==carga)return;body.innerHTML=staCrmHubHtml();staOrdenDecorar('crm');staCrmFiltrarLista()}catch(e){console.error(e);if(document.getElementById('staSheetBackdrop').classList.contains('hidden')||body.firstElementChild!==carga)return;body.innerHTML=`<div class="sta-sheet-intro"><strong>❌ No se ha podido cargar.</strong><p>${escapeHtml(e.message||'')}</p></div>`}}
function staCrmCambiarVista(v){if(!['oportunidades','clientes'].includes(v))return;staCrmVista=v;staCrmFiltroEstado=v==='oportunidades'?'confirmado':'';staCrmBusqueda='';staOrdenSeleccionado=null;const b=document.getElementById('staSheetBody');if(b){b.innerHTML=staCrmHubHtml();staOrdenDecorar('crm');staCrmFiltrarLista()}}
function staCrmClienteOptions(id){return staCrmClientes.filter(c=>c.activo||Number(c.id)===Number(id)).map(c=>`<option value="${c.id}" ${Number(c.id)===Number(id)?'selected':''}>${escapeHtml(c.nombre)}</option>`).join('')}
function staCrmEstadosOptions(v){return Object.entries(STA_CRM_ESTADOS).map(([k,n])=>`<option value="${k}" ${k===v?'selected':''}>${escapeHtml(n)}</option>`).join('')}
function staCrmEditarCliente(id){const c=id?staCrmCliente(id):{};pushStaSheet(id?'Editar cliente':'Nuevo cliente',`<div class="sta-sheet-intro"><strong>${id?'Datos del cliente':'1. Crea el cliente'}</strong><p>${id?'Los contactos se gestionan por separado dentro de su ficha.':'Guarda primero los datos generales. Después se abrirá automáticamente su ficha para añadir contactos y bolos.'}</p></div><div class="sta-crm-form"><label class="control-label full">Nombre del cliente<input id="crmCliNombre" value="${escapeHtml(c?.nombre||'')}"></label><label class="control-label">Razón social<input id="crmCliRazon" value="${escapeHtml(c?.razon_social||'')}"></label><label class="control-label">NIF/CIF<input id="crmCliNif" value="${escapeHtml(c?.nif||'')}"></label><label class="control-label">Web<input id="crmCliWeb" value="${escapeHtml(c?.web||'')}"></label><label class="control-label full">Dirección<input id="crmCliDir" value="${escapeHtml(c?.direccion||'')}"></label><label class="control-label full">Notas<textarea id="crmCliNotas">${escapeHtml(c?.notas||'')}</textarea></label></div><div id="crmCliMsg" class="muted"></div><button class="btn-primary btn-full" data-crm-guardar-cliente onclick="staCrmGuardarCliente(${id?Number(id):'null'})">💾 Guardar cliente</button>`)}
async function staCrmGuardarCliente(id){
  const msg=document.getElementById('crmCliMsg');
  const nombre=document.getElementById('crmCliNombre')?.value.trim()||'';
  const boton=document.querySelector('[data-crm-guardar-cliente]');
  const anterior=id?staCrmCliente(id):null;
  if(!nombre){if(msg)msg.textContent='Escribe el nombre del cliente.';return}
  if(boton?.disabled)return; // Impide altas duplicadas por varios toques seguidos.
  if(boton)boton.disabled=true;
  if(msg)msg.textContent='Guardando cliente…';
  let guardado=false;
  try{
    // La función actual de Supabase devuelve un identificador BIGINT.
    // Conservamos los campos de contacto heredados sin pedirlos otra vez al usuario.
    const {data,error}=await supabaseClient.rpc('crm_guardar_cliente',{
      p_id:id,
      p_nombre:nombre,
      p_razon_social:document.getElementById('crmCliRazon')?.value.trim()||null,
      p_nif:document.getElementById('crmCliNif')?.value.trim()||null,
      p_contacto_nombre:anterior?.contacto_nombre||null,
      p_contacto_email:anterior?.contacto_email||null,
      p_contacto_telefono:anterior?.contacto_telefono||null,
      p_direccion:document.getElementById('crmCliDir')?.value.trim()||null,
      p_web:document.getElementById('crmCliWeb')?.value.trim()||null,
      p_notas:document.getElementById('crmCliNotas')?.value.trim()||null
    });
    if(error)throw error;
    guardado=true;
    const clienteId=Number(data??id);
    if(!Number.isSafeInteger(clienteId)||clienteId<=0)throw new Error('El servidor no ha devuelto un identificador de cliente válido.');
    await staCrmCargar();
    if(!staCrmCliente(clienteId))throw new Error('El cliente todavía no aparece en el listado actualizado.');

    // Volver al panel CRM, nunca dejar un formulario de alta en el historial.
    // También refrescamos el panel subyacente para que «Atrás» muestre el cliente nuevo.
    volverStaSheet();
    if(id)volverStaSheet();
    staCrmVista='clientes';
    const panel=document.getElementById('staSheetBody');
    if(panel)panel.innerHTML=staCrmHubHtml();
    await staCrmAbrirCliente(clienteId);
  }catch(e){
    console.error('No se pudo completar el guardado/navegación del cliente',e);
    if(msg)msg.textContent=guardado
      ?'✅ Cliente guardado, pero no se pudo abrir su ficha. Vuelve a Clientes y actualiza el listado; no es necesario volver a guardarlo.'
      :'❌ '+(e?.message||'No se ha podido guardar el cliente.');
    if(!guardado&&boton)boton.disabled=false;
    if(guardado&&boton)boton.textContent='✓ Cliente guardado';
  }
}
function staCrmEditarOportunidad(id,clienteId){
 if(!staCrmClientes.filter(c=>c.activo).length){alert('Crea primero un cliente.');staCrmEditarCliente(null);return}
 const o=id?staCrmOportunidad(id):{},cid=clienteId||o?.cliente_id||staCrmClientes.find(c=>c.activo)?.id;
 const modalidad=['lucrativo','solidario','con_coste'].includes(o?.modalidad_bolo)?o.modalidad_bolo:'';
 const opcion=(v,l)=>`<option value="${v}" ${modalidad===v?'selected':''}>${l}</option>`;
 pushStaSheet(id?'Editar bolo':'Nuevo bolo',`<div class="sta-crm-form">
 <label class="control-label">Cliente<select id="crmOppCliente">${staCrmClienteOptions(cid)}</select></label>
 <label class="control-label">Estado del bolo<select id="crmOppEstado">${staCrmEstadosOptions(o?.estado||'nuevo')}</select></label>
 <label class="control-label full">Nombre del bolo<input id="crmOppTitulo" value="${escapeHtml(o?.titulo||'')}"></label>
 <label class="control-label">Fecha prevista<input id="crmOppFecha" type="date" value="${escapeHtml(o?.fecha_prevista||'')}"></label>
 <label class="control-label">Hora prevista<input id="crmOppHora" type="time" value="${escapeHtml(String(o?.hora_prevista||'').slice(0,5))}"></label>
 <label class="control-label full">Lugar<input id="crmOppLugar" value="${escapeHtml(o?.lugar||'')}"></label>
 <label class="control-label full">Tipo de bolo<select id="crmOppModalidad" onchange="staCrmActualizarModalidad()" required><option value="" disabled ${!modalidad?'selected':''}>Selecciona el tipo de bolo</option>${opcion('lucrativo','Lucrativo / remunerado')}${opcion('solidario','Solidario / benéfico')}${opcion('con_coste','Con coste (pagamos nosotros)')}</select></label>
 <label class="control-label full ${modalidad==='lucrativo'?'':'hidden'}" id="crmOppCacheCampo">Caché estimado / acordado (€)<input id="crmOppCache" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(o?.cache_estimado??'')}"></label>
 <label class="control-label full ${modalidad==='solidario'?'':'hidden'}" id="crmOppTecnicoCampo">Aportación para técnico / sonido (€)<input id="crmOppTecnico" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(o?.aportacion_tecnico??'')}" placeholder="Pendiente de concretar"></label>
 <div id="crmOppCosteCampos" class="full ${modalidad==='con_coste'?'':'hidden'}" style="display:grid;gap:10px">
 <label class="control-label">Coste previsto para Spirit to All (€)<input id="crmOppCoste" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(o?.coste_bolo??'')}" placeholder="Pendiente de concretar"></label>
 <label class="control-label">A quién se paga<input id="crmOppCosteDestinatario" maxlength="500" value="${escapeHtml(o?.coste_destinatario||'')}" placeholder="Parroquia, festival, asociación…"></label>
 <label class="control-label">Motivo / contraprestación<input id="crmOppCosteMotivo" maxlength="1000" value="${escapeHtml(o?.coste_motivo||'')}" placeholder="Uso del local de ensayo, cuota de participación…"></label>
 </div>
 <p id="crmOppModalidadAyuda" class="muted full" style="margin:0;font-size:12px"></p>
 <label class="control-label">Responsable${staCrmSelectorResponsable('crmOppResp',o?.responsable)}</label>
 <label class="control-label">Fecha próxima acción<input id="crmOppProxFecha" type="date" value="${escapeHtml(o?.fecha_proxima_accion||'')}"></label>
 <label class="control-label full">Próxima acción<input id="crmOppProx" value="${escapeHtml(o?.proxima_accion||'')}" placeholder="Llamar, enviar propuesta, confirmar fecha…"></label>
 <label class="control-label full">Notas<textarea id="crmOppNotas">${escapeHtml(o?.notas||'')}</textarea></label></div>
 <div id="crmOppMsg" class="muted" role="status"></div>
 <button class="btn-primary btn-full" id="crmOppGuardarBoton" onclick="staCrmGuardarOportunidad(${id?Number(id):'null'})">💾 Guardar bolo</button>`);
 staCrmActualizarModalidad();
}
async function staCrmGuardarOportunidad(id){
 const titulo=document.getElementById('crmOppTitulo')?.value.trim()||'',msg=document.getElementById('crmOppMsg'),btn=document.getElementById('crmOppGuardarBoton');
 if(!titulo){if(msg)msg.textContent='Escribe el nombre del bolo.';return}
 const modalidad=document.getElementById('crmOppModalidad')?.value||'';
 if(!['lucrativo','solidario','con_coste'].includes(modalidad)){if(msg)msg.textContent='Selecciona si el bolo es lucrativo, solidario o con coste.';return}
 const parseImporte=(id)=>{const v=document.getElementById(id)?.value?.trim()||'';return v===''?null:Number(v)};
 const cache=modalidad==='lucrativo'?parseImporte('crmOppCache'):null;
 const tecnico=modalidad==='solidario'?parseImporte('crmOppTecnico'):null;
 const coste=modalidad==='con_coste'?parseImporte('crmOppCoste'):null;
 const destinatario=modalidad==='con_coste'?(document.getElementById('crmOppCosteDestinatario')?.value.trim()||null):null;
 const motivo=modalidad==='con_coste'?(document.getElementById('crmOppCosteMotivo')?.value.trim()||null):null;
 if([cache,tecnico,coste].some(v=>v!==null&&(!Number.isFinite(v)||v<0))){if(msg)msg.textContent='Comprueba los importes; no pueden ser negativos.';return}
 if(coste!==null&&coste>999999999.99){if(msg)msg.textContent='El coste indicado es demasiado elevado.';return}
 if(btn){if(btn.disabled)return;btn.disabled=true}
 if(msg)msg.textContent='Guardando bolo…';
 try{
  const {data,error}=await supabaseClient.rpc('crm_guardar_bolo_con_coste',{
    p_id:id,
    p_cliente_id:Number(document.getElementById('crmOppCliente')?.value),
    p_titulo:titulo,
    p_estado:document.getElementById('crmOppEstado')?.value||'nuevo',
    p_fecha_prevista:document.getElementById('crmOppFecha')?.value||null,
    p_hora_prevista:document.getElementById('crmOppHora')?.value||null,
    p_lugar:document.getElementById('crmOppLugar')?.value.trim()||null,
    p_cache_estimado:cache,
    p_responsable:document.getElementById('crmOppResp')?.value.trim()||null,
    p_proxima_accion:document.getElementById('crmOppProx')?.value.trim()||null,
    p_fecha_proxima_accion:document.getElementById('crmOppProxFecha')?.value||null,
    p_notas:document.getElementById('crmOppNotas')?.value.trim()||null,
    p_modalidad_bolo:modalidad,
    p_aportacion_tecnico:tecnico,
    p_coste_bolo:coste,
    p_coste_destinatario:destinatario,
    p_coste_motivo:motivo
  });
  if(error)throw error;
  const newId=Number(data??id);
  if(!Number.isSafeInteger(newId)||newId<=0)throw new Error('No se ha podido identificar el bolo guardado');
  await staCrmCargar();
  volverStaSheet();
  if(document.getElementById('staSheetBody'))document.getElementById('staSheetBody').innerHTML=staCrmHubHtml();
  staCrmAbrirOportunidad(newId);
 }catch(e){console.error('Error guardando bolo',e);if(msg)msg.textContent='❌ '+(e?.message||'No se ha podido guardar el bolo.');}
 finally{if(btn&&document.getElementById('crmOppGuardarBoton')===btn)btn.disabled=false}
}
let staCrmFichaPeticion=0;
function staCrmVistaRapida(id){
  void staAbrirFichaBolo('bolo',Number(id));
}
async function staCrmAbrirOportunidad(id){
 const o=staCrmOportunidad(id);if(!o)return;
 const peticion=++staCrmFichaPeticion;
 const cuerpoOrigen=document.getElementById('staSheetBody')?.firstElementChild;
 let seg=[];
 try{const r=await supabaseClient.rpc('crm_listar_seguimientos',{p_oportunidad_id:Number(id)});if(!r.error)seg=r.data||[]}catch(_){}
 if(peticion!==staCrmFichaPeticion||document.getElementById('staSheetBackdrop')?.classList.contains('hidden')||document.getElementById('staSheetBody')?.firstElementChild!==cuerpoOrigen)return;
 const encuesta=o.evento_id?`<button class="btn-light" onclick="cerrarStaSheet();seleccionarEvento(${Number(o.evento_id)},'encuestas')">🎤 Ver encuesta</button>`:`<button class="btn-light" onclick="staCrmPrepararEncuesta(${Number(id)})">🎤 Crear encuesta</button>`;
 const modalidad=staCrmModalidadLabel(o.modalidad_bolo);
 const economia=o.modalidad_bolo==='solidario'?`<div class="sta-crm-kpi"><strong>${escapeHtml(staCrmEuros(o.aportacion_tecnico))}</strong><small>Aportación para el técnico</small></div>`:o.modalidad_bolo==='con_coste'?`<div class="sta-crm-kpi"><strong>${escapeHtml(staCrmEuros(o.coste_bolo))}</strong><small>Coste previsto que pagamos</small></div>`:`<div class="sta-crm-kpi"><strong>${escapeHtml(staCrmEuros(o.cache_estimado))}</strong><small>${o.modalidad_bolo==='lucrativo'?'Caché del coro':'Caché estimado (tipo pendiente)'}</small></div>`;
 pushStaSheet(o.titulo,`<div class="sta-sheet-intro"><strong>${escapeHtml(o.titulo)}</strong><p>${escapeHtml(o.cliente_nombre)} · ${escapeHtml(staCrmEstadoLabel(o.estado))} · ${escapeHtml(modalidad)}</p></div>
 <div class="sta-crm-kpis sta-crm-opp-detail-kpis"><div class="sta-crm-kpi"><strong>${o.fecha_prevista?escapeHtml(formatearFechaCorta(o.fecha_prevista)):'—'}</strong><small>Fecha y hora previstas</small><span>${escapeHtml(staFmtHora(o.hora_prevista)||'Hora por confirmar')}</span></div>${economia}<div class="sta-crm-kpi"><strong>${o.evento_id?'Sí':'No'}</strong><small>Encuesta creada</small></div></div>
 ${o.modalidad_bolo==='solidario'?'<p class="muted" style="font-size:12px">La aportación para el técnico no es el caché del coro. Los gastos reales se registran en Economía.</p>':''}
 ${o.modalidad_bolo==='con_coste'?`<div class="sta-prodopp-private-note"><strong>Concierto con coste para el coro.</strong>${o.coste_destinatario?`<div><strong>Pagamos a:</strong> ${escapeHtml(o.coste_destinatario)}</div>`:''}${o.coste_motivo?`<div><strong>Motivo:</strong> ${escapeHtml(o.coste_motivo)}</div>`:''}<small>Este importe es una previsión de gasto, no un ingreso ni un gasto contabilizado. Registra el pago real en Economía.</small></div>`:''}
 ${o.proxima_accion?`<div class="sta-prodopp-private-note"><strong>Próxima acción:</strong> ${escapeHtml(o.proxima_accion)}${o.fecha_proxima_accion?' · '+escapeHtml(formatearFechaCorta(o.fecha_proxima_accion)):''}</div>`:''}
 <section class="sta-bolo-brief"><strong>📝 ¿De qué va este bolo?</strong><p>${o.notas?escapeHtml(o.notas):'Todavía no se ha añadido una descripción del encargo. Puedes completarla desde Editar.'}</p></section>
 <div class="sta-crm-actions"><button class="btn-primary" onclick="staProdOppAbrir(${Number(id)})">🎬 Producción</button>${encuesta}<button class="btn-light" onclick="staCrmPresupuesto(${Number(id)})">€ Presupuesto</button><button class="btn-light" onclick="staCrmEditarOportunidad(${Number(id)},null)">✏️ Editar</button><button class="btn-dark wide" onclick="staCrmNuevoSeguimiento(${Number(id)})">📝 Registrar seguimiento</button></div>
 <h4>Historial comercial</h4><div class="sta-crm-timeline">${seg.length?seg.map(s=>`<div class="sta-crm-timeline-item"><strong>${escapeHtml(({llamada:'📞 Llamada',email:'✉️ Email',whatsapp:'💬 WhatsApp',reunion:'🤝 Reunión',nota:'📝 Nota',otro:'• Otro'})[s.tipo]||s.tipo)}</strong><div>${escapeHtml(s.detalle)}</div><small>${escapeHtml(s.creado_por_nombre||'Usuario')} · ${new Date(s.creado_en).toLocaleString('es-ES')}</small></div>`).join(''):'<div class="sta-crm-empty">Sin seguimientos registrados.</div>'}</div>`);
}
function staCrmNuevoSeguimiento(id){pushStaSheet('Nuevo seguimiento',`<label class="control-label">Tipo<select id="crmSegTipo"><option value="llamada">📞 Llamada</option><option value="email">✉️ Email</option><option value="whatsapp">💬 WhatsApp</option><option value="reunion">🤝 Reunión</option><option value="nota">📝 Nota</option><option value="otro">Otro</option></select></label><label class="control-label">Detalle<textarea id="crmSegDetalle" rows="5" placeholder="Qué se habló, qué queda pendiente…"></textarea></label><div id="crmSegMsg" class="muted"></div><button class="btn-primary btn-full" onclick="staCrmGuardarSeguimiento(${Number(id)})">Guardar seguimiento</button>`)}
async function staCrmGuardarSeguimiento(id){const d=document.getElementById('crmSegDetalle')?.value.trim()||'',msg=document.getElementById('crmSegMsg');if(!d){msg.textContent='Escribe el seguimiento.';return}const {error}=await supabaseClient.rpc('crm_guardar_seguimiento',{p_oportunidad_id:Number(id),p_tipo:document.getElementById('crmSegTipo')?.value||'nota',p_detalle:d});if(error){console.error(error);msg.textContent='❌ '+error.message;return}volverStaSheet();volverStaSheet();await staCrmCargar();staCrmAbrirOportunidad(id)}
function staCrmFechaRow(v={}){return `<div class="sta-crm-date-row"><label>Fecha<input class="crmEncuFecha" type="date" value="${escapeHtml(v.fecha||'')}"></label><label>Inicio<input class="crmEncuHora" type="time" value="${escapeHtml(v.hora||'')}"></label><label>Fin<input class="crmEncuFin" type="time" value="${escapeHtml(v.hora_fin||'')}"></label><label class="wide">Lugar<input class="crmEncuLugar" value="${escapeHtml(v.lugar||'')}"></label><button class="btn-light" type="button" onclick="this.closest('.sta-crm-date-row').remove()">×</button></div>`}
function staCrmPrepararEncuesta(id){if(!staTienePermiso('encuestas'))return;const o=staCrmOportunidad(id);if(!o)return;const fecha=o.fecha_prevista||'',hora=String(o.hora_prevista||'').slice(0,5),lugar=o.lugar||'';pushStaSheet('Crear encuesta desde bolo',`<div class="sta-sheet-intro"><strong>${escapeHtml(o.titulo)}</strong><p>La encuesta es opcional. Crea una solo cuando ya necesites consultar disponibilidad.</p></div><label class="control-label">Fecha límite para responder<input id="crmEncuLimite" type="date"></label><div id="crmEncuFechas">${staCrmFechaRow({fecha,hora,lugar})}</div><button class="btn-light btn-full" onclick="document.getElementById('crmEncuFechas').insertAdjacentHTML('beforeend',staCrmFechaRow())">＋ Añadir otra fecha</button><div id="crmEncuMsg" class="muted"></div><button class="btn-primary btn-full" id="crmEncuGuardar" onclick="staCrmCrearEncuesta(${Number(id)})">🎤 Crear encuesta y vincular</button>`)}
async function staCrmCrearEncuesta(id){
  if(!esGestor())return;
  const boton=document.getElementById('crmEncuGuardar'),msg=document.getElementById('crmEncuMsg');
  if(!boton||!msg||boton.disabled)return;
  const bolo=staCrmOportunidad(id);
  if(!bolo||bolo.evento_id){
    msg.textContent='Este bolo ya tiene una encuesta vinculada o ha dejado de estar disponible.';
    return;
  }
  const fechas=[...document.querySelectorAll('#crmEncuFechas .sta-crm-date-row')].map(row=>({
    fecha:row.querySelector('.crmEncuFecha').value,
    hora:row.querySelector('.crmEncuHora').value,
    hora_fin:row.querySelector('.crmEncuFin').value,
    lugar:row.querySelector('.crmEncuLugar').value.trim()
  }));
  if(!fechas.length||fechas.some(f=>!f.fecha||!f.hora)){
    msg.textContent='Completa la fecha y la hora de cada sesión o quita las filas vacías.';
    return;
  }
  if(fechas.some(f=>f.hora_fin&&f.hora_fin<=f.hora)){
    msg.textContent='La hora de fin debe ser posterior a la de inicio.';
    return;
  }
  boton.disabled=true;
  msg.textContent='Creando encuesta…';
  let creada=false;
  try{
    const {error}=await supabaseClient.rpc('crm_crear_encuesta_desde_oportunidad',{
      p_oportunidad_id:Number(id),
      p_fecha_limite:document.getElementById('crmEncuLimite').value||null,
      p_fechas:fechas
    });
    if(error)throw error;
    creada=true;
    await cargarTodo();
    await staCrmCargar();
    if(!boton.isConnected)return;
    if(staSheetHistory.at(-1)?.restaurar){volverStaSheet();return}
    volverStaSheet();
    volverStaSheet();
    staCrmAbrirOportunidad(id);
  }catch(error){
    console.error(error);
    msg.textContent=creada
      ? 'Encuesta creada. Cierra y vuelve a abrir la ficha para verla.'
      : 'No se ha podido confirmar la creación. Revisa la ficha del bolo antes de reintentar.';
  }finally{
    if(!creada)boton.disabled=false;
  }
}
async function staCrmPresupuesto(id){const o=staCrmOportunidad(id);let p=null;const r=await supabaseClient.rpc('crm_obtener_presupuesto_oportunidad',{p_oportunidad_id:Number(id)});if(!r.error)p=(r.data||[])[0]||null;pushStaSheet('Presupuesto',`<div class="sta-sheet-intro"><strong>${escapeHtml(o.titulo)}</strong><p>Puede prepararse antes de crear la encuesta.</p></div><div class="sta-crm-form"><label class="control-label full">Cliente<input id="crmPreCliente" value="${escapeHtml(p?.cliente||o.cliente_nombre||'')}"></label><label class="control-label">Email<input id="crmPreEmail" value="${escapeHtml(p?.email_destino||staCrmCliente(o.cliente_id)?.contacto_email||'')}"></label><label class="control-label">Importe (€)<input id="crmPreImporte" type="number" min="0" step="0.01" value="${escapeHtml(p?.importe??o.cache_estimado??'')}"></label><label class="control-label">Estado<select id="crmPreEstado"><option value="preparado">Preparado</option><option value="enviado" ${p?.estado==='enviado'?'selected':''}>Enviado</option><option value="aceptado" ${p?.estado==='aceptado'?'selected':''}>Aceptado</option><option value="rechazado" ${p?.estado==='rechazado'?'selected':''}>Rechazado</option><option value="anulado" ${p?.estado==='anulado'?'selected':''}>Anulado</option></select></label><label class="control-label full">Concepto<input id="crmPreConcepto" value="${escapeHtml(p?.concepto||o.titulo)}"></label><label class="control-label full">Notas<textarea id="crmPreNotas">${escapeHtml(p?.notas||'')}</textarea></label></div><div id="crmPreMsg" class="muted"></div><button class="btn-primary btn-full" onclick="staCrmGuardarPresupuesto(${Number(id)})">💾 Guardar presupuesto</button>`)}
async function staCrmGuardarPresupuesto(id){const raw=document.getElementById('crmPreImporte')?.value,msg=document.getElementById('crmPreMsg'),imp=Number(raw);if(!Number.isFinite(imp)||imp<0){msg.textContent='Revisa el importe.';return}const {error}=await supabaseClient.rpc('crm_guardar_presupuesto_oportunidad',{p_oportunidad_id:Number(id),p_cliente:document.getElementById('crmPreCliente')?.value.trim()||null,p_email_destino:document.getElementById('crmPreEmail')?.value.trim()||null,p_importe:imp,p_estado:document.getElementById('crmPreEstado')?.value||'preparado',p_concepto:document.getElementById('crmPreConcepto')?.value.trim()||null,p_notas:document.getElementById('crmPreNotas')?.value.trim()||null});if(error){console.error(error);msg.textContent='❌ '+error.message;return}msg.textContent='✅ Presupuesto guardado.'}

// ----- Producción basada en oportunidad -----
const STA_PRODOPP_AREAS=[{id:'marketing',ico:'📣',nombre:'Marketing y postureo',campo:'marketing_responsable'},{id:'comercial',ico:'💼',nombre:'Distribución comercial',campo:'comercial_responsable'},{id:'creatividad',ico:'🎨',nombre:'Creatividad',campo:'creatividad_responsable'},{id:'logistica',ico:'🚗',nombre:'Logística',campo:'logistica_responsable'},{id:'ministerio',ico:'🏛️',nombre:'Ministerio / Junta',campo:null}];
const STA_PRODOPP_PLANT={marketing:['Cartel / creatividad visual','Logos y materiales enviados','Publicación en redes y web','Coordinación de publicidad con el cliente'],comercial:['Dossier enviado','Condiciones y caché confirmados','Presupuesto revisado','Seguimiento con el cliente'],creatividad:['Vestuario definido','Texto / presentación del concierto'],logistica:['Coches / transporte organizados','Horarios y punto de encuentro confirmados','Técnico de sonido confirmado','Montaje organizado','Desmontaje organizado','Alojamiento / pernocta revisado'],ministerio:['Decisiones económicas o aprobaciones necesarias revisadas']};
function staProdOppAreas(){return STA_PRODOPP_AREAS.filter(a=>staGestionaArea(a.id)||(a.id==='creatividad'&&staTienePermiso('vestuario')))}
let staProduccionBusqueda='',staProduccionFiltro='';
function staProduccionListaHtml(){
 const opp=staBolosOrdenados(staCrmOportunidades.filter(o=>!['perdido','descartado'].includes(o.estado)),'produccion');
 const ord=staOrdenModo.produccion;
 return `<div class="sta-prodopp-filter-row"><label class="sta-list-control"><span>Buscar bolo</span><input id="staProduccionBuscarBolos" type="search" autocomplete="off" placeholder="Bolo, cliente o responsable" value="${escapeHtml(staProduccionBusqueda)}" oninput="staProduccionFiltrarLista()" ${ord?'disabled':''}></label>
 <label class="sta-list-control"><span>Estado</span><select id="staProduccionEstadoBolos" onchange="staProduccionFiltrarLista()" ${ord?'disabled':''}>${staOpcionesEstadoBolos(staProduccionFiltro,true)}</select></label>${staSelectorOrdenBolos('produccion',ord)}</div>
 <div class="sta-sort-toolbar"><span class="sta-sort-help">${ord?'Arrastra las fichas para guardar el orden manual.':''}</span><button class="sta-sort-btn" type="button" aria-pressed="${ord}" onclick="staOrdenAlternar('produccion')">${ord?'Terminar edición':'⠿ Editar orden manual'}</button></div>
 <div class="sta-crm-fichas" id="staProdOppListado">${opp.length?opp.map(o=>staBoloFichaLista(o,'produccion')).join(''):'<div class="sta-crm-empty">No hay bolos en Producción.</div>'}</div><p class="sta-crm-empty" id="staProduccionSinResultados" hidden>No hay bolos con ese estado o búsqueda.</p>`;
}
function staProduccionRenderLista(){const body=document.getElementById('staSheetBody');if(!body)return;body.innerHTML=staProduccionListaHtml();staOrdenDecorar('produccion');staProduccionFiltrarLista()}
function staProduccionFiltrarLista(){const input=document.getElementById('staProduccionBuscarBolos'),filter=document.getElementById('staProduccionEstadoBolos');if(input)staProduccionBusqueda=input.value;if(filter)staProduccionFiltro=filter.value;
 let n=0;document.querySelectorAll('#staProdOppListado .sta-produccion-card').forEach(c=>{const match=staCrmNormalizar(c.dataset.filtro).includes(staCrmNormalizar(staProduccionBusqueda.trim()))&&staBoloCoincideEstado(c.dataset.estado,staProduccionFiltro);c.hidden=!match;if(c.parentElement?.classList.contains('sta-sort-wrap'))c.parentElement.hidden=!match;if(match)n++});const el=document.getElementById('staProduccionSinResultados');if(el)el.hidden=n>0||!document.querySelector('#staProdOppListado .sta-produccion-card')}
async function abrirProduccionEventos(){if(!esGestor())return;await staCrmCargar();staProduccionRenderListaInit()}
function staProduccionRenderListaInit(){staProduccionBusqueda='';staProduccionFiltro='confirmado';abrirStaSheet('Producción',staProduccionListaHtml());staOrdenDecorar('produccion');staProduccionFiltrarLista()}

async function staProdOppAbrir(id){staProdOppId=Number(id);const o=staCrmOportunidad(id);if(!o)return;pushStaSheet('Producción',`<div class="sta-sheet-intro"><strong>Cargando producción…</strong></div>`);try{await staCargarUsuariosParaTareas();await staEquipoCargar();let [f,t,l]=await Promise.all([supabaseClient.from('produccion_oportunidades').select('*').eq('oportunidad_id',staProdOppId).maybeSingle(),supabaseClient.from('produccion_oportunidad_tareas').select('*').eq('oportunidad_id',staProdOppId).order('area').order('orden').order('id'),(staTienePermiso('logistica')?supabaseClient.rpc('obtener_logistica_oportunidad',{p_oportunidad_id:staProdOppId}):staTienePermiso('vestuario')?supabaseClient.rpc('sta_leer_vestuario_bolo',{p_bolo:staProdOppId}):Promise.resolve({data:[],error:null}))]);if(f.error)throw f.error;if(t.error)throw t.error;if(l.error)throw l.error;staProdOppFicha=f.data||{};staProdOppTareas=t.data||[];staProdOppLog=(l.data||[])[0]||{};await staProdOppAsegurarPlantilla();const rr=await supabaseClient.from('produccion_oportunidad_tareas').select('*').eq('oportunidad_id',staProdOppId).order('area').order('orden').order('id');if(rr.error)throw rr.error;staProdOppTareas=rr.data||[];staProdOppRender()}catch(e){console.error(e);document.getElementById('staSheetBody').innerHTML=`<div class="sta-sheet-intro"><strong>❌ No se ha podido cargar Producción.</strong><p>${escapeHtml(e.message||'')}</p></div>`}}
async function staProdOppAsegurarPlantilla(){
  if(!esAdmin()||staProdOppFicha?.plantilla_operativa_inicializada)return;
  const tareas=staProdOppAreas().flatMap(a=>(STA_PRODOPP_PLANT[a.id]||[]).map((titulo,i)=>({
    area:a.id,titulo,orden:(i+1)*10
  })));
  const {error}=await supabaseClient.rpc('sta_inicializar_plantilla_produccion',{p_bolo:staProdOppId,p_tareas:tareas});
  if(error)throw error;
  staProdOppFicha.plantilla_operativa_inicializada=true;
}
function staProdOppResumen(a){const t=staProdOppTareas.filter(x=>x.area===a.id),ap=t.filter(x=>x.estado!=='no_aplica'),h=ap.filter(x=>x.estado==='hecho').length;return{t,h,total:ap.length}}
let staProdOppOrdenModo=false;
function staProdOppCambiarArea(id){staProdOppArea=id;staProdOppOrdenModo=false;staProdOppElegida=null;staProdOppRender()}
function staProdOppRender(){
 const b=document.getElementById('staSheetBody'),o=staCrmOportunidad(staProdOppId);if(!b||!o)return;
 const areas=staProdOppAreas();if(!areas.length){b.textContent='Aún no tienes áreas de Producción asignadas.';return}if(!areas.some(a=>a.id===staProdOppArea))staProdOppArea=areas[0].id;
 const a=areas.find(x=>x.id===staProdOppArea),r=staProdOppResumen(a);
 b.innerHTML=`<div class="sta-prodopp-head sta-prod-head-compact"><div class="sta-prod-head-top"><div><span class="sta-overline">Producción del bolo</span><strong>${escapeHtml(o.titulo)}</strong><small>${escapeHtml(o.cliente_nombre)}${o.fecha_prevista?' · '+escapeHtml(formatearFechaCorta(o.fecha_prevista)):''} · ${escapeHtml(o.hora_prevista?String(o.hora_prevista).slice(0,5):'Hora por confirmar')}</small></div><span class="sta-crm-badge ${staCrmEstadoClase(o.estado)}">${escapeHtml(staCrmEstadoLabel(o.estado))}</span></div><div class="sta-prod-head-meta"><span>👤 ${escapeHtml(o.responsable||'Sin responsable')}</span><span>${o.evento_id?'📋 Encuesta vinculada':'◯ Sin encuesta'}</span></div>${staTienePermiso('comercial')?`<details class="sta-prod-config"><summary>✎ Cambiar estado del bolo</summary><label class="control-label">Estado actual<select id="prodOppEstadoBolo" onchange="staProdOppCambiarEstado(this.value)">${staCrmEstadosOptions(o.estado)}</select></label></details>`:''}</div>
 <div class="sta-prodopp-tabs" role="tablist" aria-label="Departamentos">${areas.map(x=>`<button type="button" role="tab" aria-selected="${x.id===staProdOppArea?'true':'false'}" class="${x.id===staProdOppArea?'active':''}" onclick="staProdOppCambiarArea('${x.id}')">${x.ico} ${escapeHtml(staProduccionNombreCorto(x))}</button>`).join('')}</div>${staProdOppAreaHtml(a,r)}`;
}
function staProdOppAreaHtml(a,r){
 const resp=a.id==='ministerio'?'':(staProdOppFicha?.[a.campo]||''),tasks=staGestionaArea(a.id)?staProdOppTasksHtml(a.id):'';
 let content=tasks;
 if(a.id==='logistica')content=staProdOppLogisticaHtml();
 if(a.id==='creatividad')content=`${staProdOppVestuarioHtml()}${tasks}`;
 return `<section class="sta-prodopp-area"><div class="sta-area-heading"><h3>${a.ico} ${escapeHtml(a.nombre)}</h3><span class="sta-count-pill">${r.h}/${r.total} hechas</span></div>
 ${a.id!=='ministerio'&&staGestionaArea(a.id)?`<details class="sta-area-coord"><summary><span><small>Coordinación del área</small><strong>👤 ${escapeHtml(resp||'Sin asignar')}</strong></span><span class="sta-mini-edit">Cambiar ›</span></summary><div class="sta-area-coord-body"><label class="control-label">Coordinador/a ${staCrmSelectorResponsable('prodOppResp',resp,a.id)}</label><button class="btn-primary" onclick="staProdOppGuardarResp('${a.id}')">Guardar coordinador</button></div></details>`:''}
 ${content}</section>`;
}
function staProdOppTasksHtml(area){
 const tareas=staProdOppTareas.filter(x=>x.area===area).slice().sort((a,b)=>(Number(a.orden||0)-Number(b.orden||0))||(Number(a.id)-Number(b.id)));
 const estadoTxt={pendiente:'Pendiente',en_curso:'En curso',hecho:'Hecho',no_aplica:'No aplica'};
 return `<div class="sta-taskboard"><div class="sta-taskboard-top"><strong>Tareas <span class="sta-task-counter">${tareas.length}</span></strong><button class="sta-inline-action" type="button" onclick="staProdOppAlternarOrden()" ${staProdOppOrdenGuardando?'disabled':''}>${staProdOppOrdenModo?'✓ Listo':'⠿ Ordenar'}</button></div>
 ${staProdOppOrdenModo?'<p class="sta-task-drag-help" id="staDragHelp">Para mover: mantén pulsado ⠿ y arrastra. Alternativa: toca ⠿ de la tarea y después ⠿ del lugar donde quieres colocarla. También puedes usar ↑ y ↓ con el teclado. Se guarda automáticamente.</p>':''}
 <div class="sta-compact-tasks" id="staListaTareasOrden" data-area="${escapeHtml(area)}">${tareas.map(t=>`<div class="sta-task-item ${t.estado==='hecho'?'sta-task-complete':''} ${staProdOppOrdenModo?'sta-task-sorting':''}" data-tarea-id="${Number(t.id)}">
 ${staProdOppOrdenModo?`<button type="button" class="sta-task-drag-handle" aria-label="Arrastrar tarea ${escapeHtml(t.titulo)}. También puedes usar las teclas arriba y abajo." aria-describedby="staDragHelp" onpointerdown="staProdOppDragIniciar(event)" onclick="staProdOppOrdenTocar(event)" onkeydown="staProdOppOrdenTeclado(event)">⠿</button>`:`<button type="button" class="sta-task-status ${escapeHtml(t.estado||'pendiente')}" aria-label="${escapeHtml(t.estado==='hecho'?'Marcar pendiente':'Marcar completada')}" onclick="staProdOppEstadoTarea(${Number(t.id)},'${t.estado==='hecho'?'pendiente':'hecho'}')">${t.estado==='hecho'?'✓':t.estado==='en_curso'?'◐':t.estado==='no_aplica'?'−':'○'}</button>`}
 <button class="sta-task-main" type="button" ${staProdOppOrdenModo?'disabled':'onclick="staProdOppEditarTarea('+Number(t.id)+')"'}><strong>${escapeHtml(t.titulo)}</strong><span>👤 ${escapeHtml(t.responsable||staPersonaNombre(t.responsable_usuario_id)||'Sin asignar')}${t.fecha_limite?' · '+escapeHtml(formatearFechaCorta(t.fecha_limite)):''}</span></button>
 ${!staProdOppOrdenModo?`<span class="sta-status-pill ${escapeHtml(t.estado||'pendiente')}">${escapeHtml(estadoTxt[t.estado]||'Pendiente')}</span><button type="button" class="sta-task-arrow" aria-label="Editar ${escapeHtml(t.titulo)}" onclick="staProdOppEditarTarea(${Number(t.id)})">›</button>`:''}
 </div>`).join('')||'<p class="sta-muted-empty">Todavía no hay tareas en esta área.</p>'}</div>
 ${!staProdOppOrdenModo?`<details class="sta-add-task"><summary>＋ Añadir tarea</summary><div class="sta-prod-add"><input id="prodOppNueva" maxlength="160" placeholder="¿Qué hay que hacer?"><button type="button" class="btn-dark" onclick="staProdOppAgregarTarea('${area}')">Añadir</button></div></details>`:''}</div>`;
}
function staProdOppAlternarOrden(){if(staProdOppOrdenGuardando||staProdOppDrag)return;staProdOppOrdenModo=!staProdOppOrdenModo;staProdOppElegida=null;staProdOppRender()}
let staProdOppOrdenGuardando=false;
let staProdOppDrag=null;let staProdOppElegida=null;let staProdOppArrastreFin=0;
function staProdOppDragIniciar(ev){
 if(!staProdOppOrdenModo||staProdOppOrdenGuardando||staProdOppDrag||ev.button!==0)return;
 const handle=ev.currentTarget,row=handle.closest('.sta-task-item'),list=row?.parentElement;
 if(!row||!list||!list.dataset.area||!Number(row.dataset.tareaId))return;
 ev.preventDefault();
 try{handle.setPointerCapture(ev.pointerId)}catch(_e){}
 staProdOppDrag={handle,row,list,pointerId:ev.pointerId,inicio:[...list.children].filter(n=>n.dataset.tareaId).map(n=>Number(n.dataset.tareaId)),area:list.dataset.area};
 document.addEventListener('pointermove',staProdOppDragMover,{passive:false});
 document.addEventListener('pointerup',staProdOppDragTerminar);
 document.addEventListener('pointercancel',staProdOppDragCancelar);
 row.classList.add('sta-task-dragging');list.classList.add('sta-drag-active');
}
function staProdOppDragMover(ev){
 const d=staProdOppDrag;
 if(!d||ev.pointerId!==d.pointerId||!d.row.isConnected)return;
 ev.preventDefault();
 const destino=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.sta-task-item');
 if(destino&&destino!==d.row&&destino.parentElement===d.list){
  const r=destino.getBoundingClientRect();
  d.list.insertBefore(d.row,ev.clientY<r.top+r.height/2?destino:destino.nextElementSibling);
 }
 const panel=document.getElementById('staSheetBody');
 if(panel){const rect=panel.getBoundingClientRect();if(ev.clientY<rect.top+65)panel.scrollTop-=12;else if(ev.clientY>rect.bottom-65)panel.scrollTop+=12}
}
async function staProdOppGuardarOrden(ids,area,previos){
 if(staProdOppOrdenGuardando)return;
 if(ids.length===previos.length&&ids.every((id,i)=>id===previos[i]))return;
 const boloId=staProdOppId;
 staProdOppOrdenGuardando=true;
 try{
  const guardado=await supabaseClient.rpc('sta_ordenar_tareas_bolo',{p_bolo_id:Number(boloId),p_area:area,p_ids:ids});
  if(guardado.error)throw guardado.error;
  const nuevo=await supabaseClient.from('produccion_oportunidad_tareas').select('*').eq('oportunidad_id',boloId).order('area').order('orden').order('id');
  if(nuevo.error)throw nuevo.error;
  if(staProdOppId===boloId)staProdOppTareas=nuevo.data||[];
 }catch(err){
  console.error('No se pudo guardar el orden de tareas',err);
  alert('No se ha podido guardar el nuevo orden. Recarga esta pantalla e inténtalo de nuevo. '+(err.message||''));
  try{const r=await supabaseClient.from('produccion_oportunidad_tareas').select('*').eq('oportunidad_id',boloId).order('area').order('orden').order('id');if(!r.error&&staProdOppId===boloId)staProdOppTareas=r.data||[]}catch(e){}
 }finally{staProdOppOrdenGuardando=false;if(staProdOppId===boloId)staProdOppRender()}
}
function staProdOppDragTerminar(ev){
 const d=staProdOppDrag;if(!d||d.pointerId!==ev.pointerId)return;
 ev.preventDefault();staProdOppDrag=null;
 staProdOppDragDesvincular();
 d.row.classList.remove('sta-task-dragging');d.list.classList.remove('sta-drag-active');
 const ids=[...d.list.children].filter(n=>n.dataset.tareaId).map(n=>Number(n.dataset.tareaId));
 if(!ids.every((v,i)=>v===d.inicio[i]))staProdOppArrastreFin=Date.now();
 void staProdOppGuardarOrden(ids,d.area,d.inicio);
}
function staProdOppDragDesvincular(){
 document.removeEventListener('pointermove',staProdOppDragMover);
 document.removeEventListener('pointerup',staProdOppDragTerminar);
 document.removeEventListener('pointercancel',staProdOppDragCancelar);
}
function staProdOppDragCancelar(ev){
 const d=staProdOppDrag;if(!d||d.pointerId!==ev.pointerId)return;
 staProdOppDrag=null;staProdOppDragDesvincular();d.row.classList.remove('sta-task-dragging');d.list.classList.remove('sta-drag-active');staProdOppRender();
}
function staProdOppOrdenTeclado(ev){
 if(!['ArrowUp','ArrowDown'].includes(ev.key)||staProdOppOrdenGuardando||!staProdOppOrdenModo)return;
 ev.preventDefault();
 const row=ev.currentTarget.closest('.sta-task-item'),list=row?.parentElement;
 if(!row||!list)return;
 const previos=[...list.children].filter(n=>n.dataset.tareaId).map(n=>Number(n.dataset.tareaId));
 const other=ev.key==='ArrowUp'?row.previousElementSibling:row.nextElementSibling;
 if(!other?.dataset.tareaId)return;
 list.insertBefore(row,ev.key==='ArrowUp'?other:other.nextElementSibling);
 const ids=[...list.children].filter(n=>n.dataset.tareaId).map(n=>Number(n.dataset.tareaId));
 void staProdOppGuardarOrden(ids,list.dataset.area,previos);
}
function staProdOppOrdenTocar(ev){
 if(Date.now()-staProdOppArrastreFin<500||!staProdOppOrdenModo||staProdOppOrdenGuardando)return;
 const row=ev.currentTarget.closest('.sta-task-item'),list=row?.parentElement;
 if(!row||!list)return;
 if(!staProdOppElegida){staProdOppElegida=Number(row.dataset.tareaId);row.classList.add('sta-sort-selected');return}
 const selected=list.querySelector('.sta-task-item[data-tarea-id="'+staProdOppElegida+'"]');
 const prev=[...list.children].filter(x=>x.dataset.tareaId).map(x=>Number(x.dataset.tareaId));
 staProdOppElegida=null;list.querySelectorAll('.sta-sort-selected').forEach(x=>x.classList.remove('sta-sort-selected'));
 if(!selected||selected===row)return;
 list.insertBefore(selected,row);
 const ids=[...list.children].filter(x=>x.dataset.tareaId).map(x=>Number(x.dataset.tareaId));
 void staProdOppGuardarOrden(ids,list.dataset.area,prev);
}
async function staProdOppCambiarEstado(estado){
  if(!staTienePermiso('comercial'))return;
  const o=staCrmOportunidad(staProdOppId);if(!o)return;
  const anterior=o.estado;if(estado===anterior)return;
  const selector=document.getElementById('prodOppEstadoBolo');if(selector)selector.disabled=true;
  try{
    const r=await supabaseClient.rpc('sta_cambiar_estado_bolo',{p_bolo_id:Number(staProdOppId),p_estado:estado});
    if(r.error)throw r.error;
    o.estado=estado;
    staProdOppRender();
  }catch(e){console.error(e);alert('No se pudo cambiar el estado. '+(e.message||''));if(selector){selector.value=anterior;selector.disabled=false;}}
}

async function staProdOppGuardarResp(area){const a=STA_PRODOPP_AREAS.find(x=>x.id===area);if(!a?.campo)return;const patch={[a.campo]:document.getElementById('prodOppResp')?.value.trim()||null,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null};const r=await supabaseClient.from('produccion_oportunidades').update(patch).eq('oportunidad_id',staProdOppId).select('*').single();if(r.error){alert('No se ha podido guardar.');return}staProdOppFicha=r.data;staProdOppRender()}
async function staProdOppEstadoTarea(id,estado){const r=await supabaseClient.from('produccion_oportunidad_tareas').update({estado,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null}).eq('id',Number(id)).eq('oportunidad_id',staProdOppId).select('*').single();if(r.error){alert('No se ha podido cambiar la tarea.');return}Object.assign(staProdOppTareas.find(x=>Number(x.id)===Number(id))||{},r.data);staProdOppRender()}
function staProdOppEditarTarea(id){const t=staProdOppTareas.find(x=>Number(x.id)===Number(id));if(!t)return;pushStaSheet('Tarea',`<label class="control-label">Responsable o equipo externo<input id="prodOppTaskResp" value="${escapeHtml(t.responsable||'')}"></label>${staTaskSelectorUsuario('prodOppTaskUsuario',t.responsable_usuario_id)}<label class="control-label">Fecha límite<input id="prodOppTaskFecha" type="date" value="${escapeHtml(t.fecha_limite||'')}"></label><label class="control-label">Enlace<input id="prodOppTaskLink" value="${escapeHtml(t.enlace||'')}"></label><label class="control-label">Notas<textarea id="prodOppTaskNotas">${escapeHtml(t.notas||'')}</textarea></label><button class="btn-primary btn-full" onclick="staProdOppGuardarTarea(${Number(id)})">Guardar</button><button class="btn-no btn-full" onclick="staProdOppEliminarTarea(${Number(id)})">🗑️ Eliminar tarea</button>`)}
async function staProdOppGuardarTarea(id){const prev=staProdOppTareas.find(x=>Number(x.id)===Number(id));const oldUser=prev?.responsable_usuario_id||null;const patch={...staTaskResponsableDatos('prodOppTaskUsuario','prodOppTaskResp'),fecha_limite:document.getElementById('prodOppTaskFecha')?.value||null,enlace:document.getElementById('prodOppTaskLink')?.value.trim()||null,notas:document.getElementById('prodOppTaskNotas')?.value.trim()||null,actualizado_en:new Date().toISOString(),actualizado_por:usuarioActual?.id||null};const r=await supabaseClient.from('produccion_oportunidad_tareas').update(patch).eq('id',Number(id)).eq('oportunidad_id',staProdOppId).select('*').single();if(r.error){alert('No se ha podido guardar.');return}Object.assign(staProdOppTareas.find(x=>Number(x.id)===Number(id))||{},r.data);volverStaSheet();staProdOppRender();if(patch.responsable_usuario_id&&patch.responsable_usuario_id!==oldUser)void staTaskAvisarAsignacion('bolo',id);}
async function staProdOppEliminarTarea(id){if(!confirm('¿Eliminar esta tarea?'))return;const r=await supabaseClient.from('produccion_oportunidad_tareas').delete().eq('id',Number(id)).eq('oportunidad_id',staProdOppId);if(r.error){alert('No se ha podido eliminar.');return}staProdOppTareas=staProdOppTareas.filter(x=>Number(x.id)!==Number(id));volverStaSheet();staProdOppRender()}
async function staProdOppAgregarTarea(area){const inp=document.getElementById('prodOppNueva'),titulo=inp?.value.trim()||'';if(!titulo)return;const orden=Math.max(0,...staProdOppTareas.filter(t=>t.area===area).map(t=>Number(t.orden||0)))+10;const r=await supabaseClient.from('produccion_oportunidad_tareas').insert({oportunidad_id:staProdOppId,area,titulo,orden,creado_por:usuarioActual?.id||null,actualizado_por:usuarioActual?.id||null}).select('*').single();if(r.error){alert(r.error.code==='23505'?'La tarea ya existe.':'No se ha podido añadir.');return}staProdOppTareas.push(r.data);staProdOppRender()}
function staProdOppLogisticaHtml(){const l=staProdOppLog||{};return `<div class="sta-prodopp-logtabs"><button class="${staProdOppLogTab==='tecnica'?'active':''}" onclick="staProdOppLogTab='tecnica';staProdOppRender()">🎛️ Técnica</button><button class="${staProdOppLogTab==='hotel'?'active':''}" onclick="staProdOppLogTab='hotel';staProdOppRender()">🏨 Alojamiento</button><button class="${staProdOppLogTab==='tareas'?'active':''}" onclick="staProdOppLogTab='tareas';staProdOppRender()">📋 Tareas</button></div>${staProdOppLogTab==='hotel'?staProdOppHotelHtml():staProdOppLogTab==='tareas'?staProdOppTasksHtml('logistica'):staProdOppTecnicaHtml()}`}
function staProdOppTecnicaHtml(){const l=staProdOppLog||{};return `<div class="sta-crm-form"><label class="control-label">Estado técnico<select id="oppTecEstado"><option value="pendiente">Pendiente</option><option value="confirmado" ${l.tecnico_sonido_estado==='confirmado'?'selected':''}>Confirmado</option><option value="no_necesario" ${l.tecnico_sonido_estado==='no_necesario'?'selected':''}>No necesario</option></select></label><label class="control-label">Técnico/a<input id="oppTecNombre" value="${escapeHtml(l.tecnico_sonido_nombre||'')}"></label><label class="control-label">Quién monta<input id="oppMontaje" value="${escapeHtml(l.montaje_responsables||'')}"></label><label class="control-label">Quién desmonta<input id="oppDesmontaje" value="${escapeHtml(l.desmontaje_responsables||'')}"></label><label class="control-label">Hora montaje<input id="oppHoraMont" type="time" value="${escapeHtml(String(l.hora_montaje||'').slice(0,5))}"></label><label class="control-label">Hora desmontaje<input id="oppHoraDes" type="time" value="${escapeHtml(String(l.hora_desmontaje||'').slice(0,5))}"></label><label class="control-label full">Punto de acceso / técnico<input id="oppPunto" value="${escapeHtml(l.punto_tecnico||'')}"></label><label class="control-label full">Indicaciones para miembros<textarea id="oppNotasMiembros">${escapeHtml(l.notas_miembros||'')}</textarea></label></div><button class="btn-primary btn-full" onclick="staProdOppGuardarTecnica()">💾 Guardar técnica y transporte</button>`}
function staProdOppVestuarioHtml(){const l=staProdOppLog||{};return `<div style="margin:10px 0"><h4>👗 Vestuario</h4><div class="sta-crm-form"><label class="control-label">Estado<select id="oppVestEstado"><option value="pendiente">Por definir</option><option value="definido" ${l.vestuario_estado==='definido'?'selected':''}>Definido</option><option value="no_aplica" ${l.vestuario_estado==='no_aplica'?'selected':''}>No aplica</option></select></label><label class="control-label full">Indicaciones<textarea id="oppVestTexto">${escapeHtml(l.vestuario_indicaciones||'')}</textarea></label></div><button class="btn-light btn-full" onclick="staProdOppGuardarVestuario()">Guardar vestuario</button></div>`}
function staProdOppHotelHtml(){const l=staProdOppLog||{};return `<div class="sta-prodopp-hotel-note">🏨 Esta información pertenece a Logística. Los datos de reserva privados no se muestran al coro.</div><div class="sta-crm-form"><label class="control-label">Pernocta<select id="oppHotelEstado"><option value="pendiente">Por decidir</option><option value="no_necesaria" ${l.pernocta_estado==='no_necesaria'?'selected':''}>No necesaria</option><option value="necesaria" ${l.pernocta_estado==='necesaria'?'selected':''}>Necesaria</option><option value="reservada" ${l.pernocta_estado==='reservada'?'selected':''}>Reservada</option><option value="confirmada" ${l.pernocta_estado==='confirmada'?'selected':''}>Confirmada</option></select></label><label class="control-label">Responsable alojamiento${staCrmSelectorResponsable('oppHotelResp',l.responsable_alojamiento,'logistica')}</label><label class="control-label full">Hotel<input id="oppHotelNombre" value="${escapeHtml(l.hotel_nombre||'')}"></label><label class="control-label full">Dirección<input id="oppHotelDir" value="${escapeHtml(l.hotel_direccion||'')}"></label><label class="control-label full">Enlace hotel / reserva<input id="oppHotelUrl" value="${escapeHtml(l.hotel_url||'')}"></label><label class="control-label">Entrada<input id="oppHotelEntrada" type="date" value="${escapeHtml(l.fecha_entrada||'')}"></label><label class="control-label">Salida<input id="oppHotelSalida" type="date" value="${escapeHtml(l.fecha_salida||'')}"></label><label class="control-label">Check-in<input id="oppHotelIn" type="time" value="${escapeHtml(String(l.hora_checkin||'').slice(0,5))}"></label><label class="control-label">Check-out<input id="oppHotelOut" type="time" value="${escapeHtml(String(l.hora_checkout||'').slice(0,5))}"></label><label class="control-label full">Habitaciones / reparto<input id="oppHotelHab" value="${escapeHtml(l.habitaciones||'')}"></label><label class="control-label">Reserva a nombre de<input id="oppHotelReservaNombre" value="${escapeHtml(l.reserva_a_nombre||'')}"></label><label class="control-label">Código de reserva<input id="oppHotelCodigo" value="${escapeHtml(l.reserva_codigo||'')}"></label><label class="control-label full">Información pública para el coro<textarea id="oppHotelPublico">${escapeHtml(l.notas_alojamiento_publicas||'')}</textarea></label><label class="control-label full">Notas internas de gestión<textarea id="oppHotelPrivado">${escapeHtml(l.notas_alojamiento_internas||'')}</textarea></label><label class="control-label full"><input id="oppHotelPublicar" type="checkbox" ${l.alojamiento_publicar?'checked':''}> Publicar hotel/pernocta para los miembros cuando exista encuesta</label></div><div class="sta-prodopp-private-note">🔐 El nombre/código de reserva y las notas internas se guardan cifrados y solo están disponibles para gestión.</div><button class="btn-primary btn-full" onclick="staProdOppGuardarHotel()">💾 Guardar alojamiento</button>`}
function staProdOppPayload(extra={}){const l=staProdOppLog||{};return {p_oportunidad_id:staProdOppId,p_tecnico_sonido_nombre:l.tecnico_sonido_nombre||null,p_tecnico_sonido_estado:l.tecnico_sonido_estado||'pendiente',p_montaje_responsables:l.montaje_responsables||null,p_desmontaje_responsables:l.desmontaje_responsables||null,p_hora_montaje:l.hora_montaje||null,p_hora_desmontaje:l.hora_desmontaje||null,p_punto_tecnico:l.punto_tecnico||null,p_notas_miembros:l.notas_miembros||null,p_vestuario_estado:l.vestuario_estado||'pendiente',p_vestuario_indicaciones:l.vestuario_indicaciones||null,p_pernocta_estado:l.pernocta_estado||'pendiente',p_hotel_nombre:l.hotel_nombre||null,p_hotel_direccion:l.hotel_direccion||null,p_hotel_url:l.hotel_url||null,p_fecha_entrada:l.fecha_entrada||null,p_fecha_salida:l.fecha_salida||null,p_hora_checkin:l.hora_checkin||null,p_hora_checkout:l.hora_checkout||null,p_habitaciones:l.habitaciones||null,p_responsable_alojamiento:l.responsable_alojamiento||null,p_reserva_a_nombre:l.reserva_a_nombre||null,p_reserva_codigo:l.reserva_codigo||null,p_notas_alojamiento_publicas:l.notas_alojamiento_publicas||null,p_notas_alojamiento_internas:l.notas_alojamiento_internas||null,p_alojamiento_publicar:Boolean(l.alojamiento_publicar),...extra}}
async function staProdOppGuardarPayload(payload){const r=await supabaseClient.rpc('guardar_logistica_oportunidad',payload);if(r.error){console.error(r.error);alert('No se ha podido guardar Logística. '+(r.error.message||''));return false}const l=await supabaseClient.rpc('obtener_logistica_oportunidad',{p_oportunidad_id:staProdOppId});if(!l.error)staProdOppLog=(l.data||[])[0]||{};staProdOppRender();return true}
async function staProdOppGuardarTecnica(){return staProdOppGuardarPayload(staProdOppPayload({p_tecnico_sonido_nombre:document.getElementById('oppTecNombre')?.value.trim()||null,p_tecnico_sonido_estado:document.getElementById('oppTecEstado')?.value||'pendiente',p_montaje_responsables:document.getElementById('oppMontaje')?.value.trim()||null,p_desmontaje_responsables:document.getElementById('oppDesmontaje')?.value.trim()||null,p_hora_montaje:document.getElementById('oppHoraMont')?.value||null,p_hora_desmontaje:document.getElementById('oppHoraDes')?.value||null,p_punto_tecnico:document.getElementById('oppPunto')?.value.trim()||null,p_notas_miembros:document.getElementById('oppNotasMiembros')?.value.trim()||null}))}
async function staProdOppGuardarVestuario(){
 const estado=document.getElementById('oppVestEstado')?.value||'pendiente';
 const indicaciones=document.getElementById('oppVestTexto')?.value.trim()||null;
 const {error}=await supabaseClient.rpc('sta_publicar_vestuario',{p_bolo:staProdOppId,p_estado:estado,p_indicaciones:indicaciones});
 if(error){alert('No se pudo publicar el vestuario. '+error.message);return}
 staProdOppLog={...staProdOppLog,vestuario_estado:estado,vestuario_indicaciones:indicaciones};
 staProdOppRender();
 alert('Vestuario guardado.');
}
async function staProdOppGuardarHotel(){return staProdOppGuardarPayload(staProdOppPayload({p_pernocta_estado:document.getElementById('oppHotelEstado')?.value||'pendiente',p_hotel_nombre:document.getElementById('oppHotelNombre')?.value.trim()||null,p_hotel_direccion:document.getElementById('oppHotelDir')?.value.trim()||null,p_hotel_url:document.getElementById('oppHotelUrl')?.value.trim()||null,p_fecha_entrada:document.getElementById('oppHotelEntrada')?.value||null,p_fecha_salida:document.getElementById('oppHotelSalida')?.value||null,p_hora_checkin:document.getElementById('oppHotelIn')?.value||null,p_hora_checkout:document.getElementById('oppHotelOut')?.value||null,p_habitaciones:document.getElementById('oppHotelHab')?.value.trim()||null,p_responsable_alojamiento:document.getElementById('oppHotelResp')?.value.trim()||null,p_reserva_a_nombre:document.getElementById('oppHotelReservaNombre')?.value.trim()||null,p_reserva_codigo:document.getElementById('oppHotelCodigo')?.value.trim()||null,p_notas_alojamiento_publicas:document.getElementById('oppHotelPublico')?.value.trim()||null,p_notas_alojamiento_internas:document.getElementById('oppHotelPrivado')?.value.trim()||null,p_alojamiento_publicar:Boolean(document.getElementById('oppHotelPublicar')?.checked)}))}

function abrirCentroViabilidad(){
  if(staTienePermiso('viabilidad'))abrirGestionViabilidadEncuesta();
}
function abrirGestionViabilidadEncuesta(){
  if(!staTienePermiso('viabilidad'))return;
  cerrarStaSheet();
  cerrarPantallasHerramientas('panelGestor');
  configurarPantallaGestion('viabilidad');
  document.getElementById('panelGestor').classList.remove('hidden');
  document.body.style.overflow='hidden';
  cambiarGestionPrincipal('administrar');
  volverAListaGestionEncuestas();
  staPushEstadoPwa('gestion');
}

// ----- Alojamiento público en el detalle de la actuación -----
async function cargarInfoAlojamientoEvento(eventoId){const box=document.getElementById('infoAlojamientoEvento');if(!box)return;box.classList.add('hidden');box.innerHTML='';const e=(eventosActuales||[]).find(x=>Number(x.id)===Number(eventoId));if(!e||e.eliminado||!['confirmado','finalizado'].includes(e.estado))return;const r=await supabaseClient.from('produccion_logistica_publica').select('pernocta_estado,hotel_nombre,hotel_direccion,hotel_url,fecha_entrada,fecha_salida,hora_checkin,hora_checkout,habitaciones,notas_alojamiento_publicas,alojamiento_publicar').eq('evento_id',Number(eventoId)).maybeSingle();if(r.error||!r.data?.alojamiento_publicar)return;const d=r.data,txt=d.pernocta_estado==='no_necesaria'?'No es necesario pernoctar':d.hotel_nombre||'Alojamiento pendiente';box.innerHTML=`<button type="button" class="sta-hotel-disclosure" onclick="abrirInfoAlojamientoEvento(${Number(eventoId)})"><span class="sta-hotel-disclosure-icon">🏨</span><span class="sta-hotel-disclosure-copy"><strong>Alojamiento</strong><small>${escapeHtml(txt)}${d.fecha_entrada?' · '+escapeHtml(formatearFechaCorta(d.fecha_entrada)):''}</small></span><span class="sta-crm-badge ${d.pernocta_estado==='confirmada'?'ok':''}">${escapeHtml(d.pernocta_estado==='no_necesaria'?'No pernocta':d.pernocta_estado==='confirmada'?'Confirmado':d.pernocta_estado==='reservada'?'Reservado':'Info')}</span><span class="sta-hotel-chevron">›</span></button>`;box.classList.remove('hidden')}
async function abrirInfoAlojamientoEvento(eventoId){const r=await supabaseClient.from('produccion_logistica_publica').select('pernocta_estado,hotel_nombre,hotel_direccion,hotel_url,fecha_entrada,fecha_salida,hora_checkin,hora_checkout,habitaciones,notas_alojamiento_publicas,alojamiento_publicar').eq('evento_id',Number(eventoId)).maybeSingle();if(r.error||!r.data?.alojamiento_publicar){alert('Aún no hay alojamiento publicado.');return}const d=r.data,f=(ico,k,v)=>v?`<div class="sta-tech-ios-row"><span class="ico">${ico}</span><span class="copy"><small>${escapeHtml(k)}</small><strong>${escapeHtml(v)}</strong></span></div>`:'';abrirStaSheet('Alojamiento',`<div class="sta-tech-screen-hero"><span class="ico">🏨</span><div><strong>Alojamiento / pernocta</strong><small>${escapeHtml(d.hotel_nombre||'Información de viaje')}</small></div></div><div class="sta-tech-ios-group">${f('🏨','Hotel',d.hotel_nombre)}${f('📍','Dirección',d.hotel_direccion)}${f('📅','Entrada',d.fecha_entrada?formatearFechaCorta(d.fecha_entrada):'')}${f('📅','Salida',d.fecha_salida?formatearFechaCorta(d.fecha_salida):'')}${f('🕐','Check-in',String(d.hora_checkin||'').slice(0,5))}${f('🕐','Check-out',String(d.hora_checkout||'').slice(0,5))}${f('🛏️','Habitaciones',d.habitaciones)}</div>${d.hotel_url?`<a class="btn-light btn-full" href="${escapeHtml(d.hotel_url)}" target="_blank" rel="noopener">Abrir hotel / ubicación</a>`:''}${d.notas_alojamiento_publicas?`<div class="sta-tech-note"><small>Indicaciones</small><strong>${escapeHtml(d.notas_alojamiento_publicas)}</strong></div>`:''}`,'event-detail')}


// =========================================================
// CENTRO DE CONTROL + HOJA DE RUTA + CONTACTOS CRM · 2026-10-23
// =========================================================
function staFmtFechaCorta(v){return v?formatearFechaCorta(String(v).slice(0,10)):'—'}
function staFmtHora(v){return v?String(v).slice(0,5):''}
function staControlVacio(texto){return `<div class="sta-crm-empty">${escapeHtml(texto)}</div>`}
function staControlFila(ico,titulo,detalle,accion,clase=''){
  return `<button type="button" class="sta-control-row ${clase}" onclick="${accion}"><span class="sta-control-ico">${ico}</span><span class="sta-control-copy"><strong>${escapeHtml(titulo)}</strong><small>${escapeHtml(detalle||'')}</small></span><span class="sta-control-chev">›</span></button>`
}
function staControlBloque(titulo,ico,items,render,vacio,ocultarVacio=false){
  if(ocultarVacio&&!items.length)return '';
  return `<section class="sta-control-section"><div class="sta-control-title"><span>${ico}</span><strong>${escapeHtml(titulo)}</strong><b>${items.length}</b></div>${items.length?`<div class="sta-control-list">${items.map(render).join('')}</div>`:staControlVacio(vacio)}</section>`
}
async function staAbrirTareaHoy(bolo,area,tarea){
  await staCrmCargar();
  await staProdOppAbrir(bolo);
  if(!staProdOppTareas.some(t=>Number(t.id)===tarea))return;
  staProdOppCambiarArea(area);
  staProdOppEditarTarea(tarea);
}
async function staMostrarHoyGestor(){
  abrirStaSheet('Hoy','<p class="sta-sheet-intro">Cargando tareas de tus áreas…</p>');
  const body=document.getElementById('staSheetBody');
  const carga=body.firstElementChild;
  const {data,error}=await supabaseClient.rpc('sta_tareas_hoy');
  if(body.firstElementChild!==carga||document.getElementById('staSheetBackdrop').classList.contains('hidden'))return;
  if(error){body.textContent='No se pudieron cargar las tareas de tus áreas.';staHoyPrepararCambios();return}
  const areas=STA_PRODOPP_AREAS;
  const tareas=(data||[]).filter(t=>areas.some(a=>a.id===t.area));
  body.innerHTML=[['vencida','Vencidas','🔴'],['proxima','Vencen en los próximos 7 días','🟠'],['sin_asignar','Sin asignar','📋']]
    .map(([id,titulo,ico])=>staControlBloque(titulo,ico,tareas.filter(t=>t.grupo===id),t=>{
      const area=areas.find(a=>a.id===t.area);
      return staControlFila(ico,t.titulo,[area.nombre,t.oportunidad,t.fecha_limite?staFmtFechaCorta(t.fecha_limite):''].filter(Boolean).join(' · '),
        "staAbrirTareaHoy("+Number(t.oportunidad_id)+",'"+area.id+"',"+Number(t.tarea_id)+")");
    },'Sin tareas.')).join('');
  staHoyPrepararCambios();
}
function staHoyPrepararCambios(){
  const cuerpo=document.getElementById('staSheetBody');
  const zona=document.createElement('div');
  zona.id='staCambiosDisponibilidad';
  cuerpo.prepend(zona);
  void staHoyCargarCambios();
}

async function staHoyCargarCambios(parametros={}){
  const zona=document.getElementById('staCambiosDisponibilidad');
  if(!zona)return;
  const {data,error}=await supabaseClient.rpc('sta_bandeja_disponibilidad',parametros);
  if(!zona.isConnected)return;
  if(error){
    zona.innerHTML='<p role="status">No se pudieron consultar los cambios de disponibilidad. <button class="btn-light" onclick="staHoyCargarCambios()">Reintentar</button></p>';
    return;
  }
  if(!data?.admin&&!data?.es_responsable)return;
  const opcion=data.admin?`<details><summary>Responsable de los avisos</summary>
    <form onsubmit="event.preventDefault();staHoyCargarCambios({p_responsable:this.elements.responsable.value})">
      <label class="control-label">Cuenta responsable<select name="responsable" required>
        <option value="">Selecciona una cuenta de gestión</option>
        ${(data.cuentas||[]).map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===data.responsable?'selected':''}>${escapeHtml(c.nombre||'Sin nombre')}</option>`).join('')}
      </select></label><button type="submit" class="btn-light">Guardar responsable</button>
    </form></details>`:'';
  const respuesta=v=>v==='si'?'Sí, voy':v==='no'?'No puedo':'Sin responder';
  const avisos=(data.avisos||[]).map(c=>`<div class="sta-sheet-intro">
    <strong>${escapeHtml(c.titulo||'Actuación')} · ${escapeHtml(c.nombre||'Miembro del coro')}</strong>
    <p>${escapeHtml([c.fecha?formatearFechaLarga(c.fecha):'',formatearHora(c.hora)].filter(Boolean).join(' · '))}</p>
    <p>${respuesta(c.anterior)} → <strong>${respuesta(c.respuesta)}</strong></p>
    <button class="btn-light" type="button" onclick="this.disabled=true;staHoyCargarCambios({p_revisar:${Number(c.id)}})">Marcar como revisado</button>
  </div>`).join('');
  zona.innerHTML=`<section class="sta-control-section"><div class="sta-control-title"><strong>Cambios en encuestas confirmadas</strong></div>
    ${data.es_responsable?(avisos||'<p class="muted">Sin cambios por revisar.</p>'):data.responsable?'':'<p class="muted">Elige quién debe recibir estos avisos en Hoy.</p>'}
    ${opcion}</section>`;
}

async function abrirCentroControl(){
  if(!esGestor())return;
  if(!esAdmin())return staMostrarHoyGestor();
  abrirStaSheet('Hoy','<div class="sta-sheet-intro"><strong>📍 Centro de control</strong><p>Reuniendo lo que necesita atención…</p></div>');
  const body=document.getElementById('staSheetBody');
  try{
    const {data,error}=await supabaseClient.rpc('crm_centro_control');if(error)throw error;
    const d=data||{},acciones=d.acciones||[],encuestas=d.encuestas||[],tareas=d.tareas||[],aloj=d.alojamiento||[],pres=d.presupuestos||[],prox=d.proximos||[];
    const total=acciones.length+encuestas.length+tareas.length+aloj.length+pres.length;
    body.innerHTML=`<div class="sta-hoy-dashboard"><div class="sta-control-hero ${total?'attention':'ok'}"><span class="ico">${total?'📍':'✅'}</span><div><strong>${total?`${total} asunto${total===1?'':'s'} para revisar`:'Todo controlado'}</strong><small>${total?'Abre cada asunto para resolverlo en su apartado.':'No hay asuntos que requieran atención ahora.'}</small></div></div><div class="sta-hoy-metrics"><span><b>${encuestas.length}</b> Encuestas</span><span><b>${tareas.length}</b> Tareas</span><span><b>${aloj.length}</b> Alojamientos</span></div><h3 class="sta-hoy-heading">Necesita atención</h3>`+
      staControlBloque('Encuestas por responder','⏳',encuestas,e=>staControlFila('⏳',e.titulo,`${staFmtFechaCorta(e.fecha)} · ${Number(e.pendientes||0)} pendiente${Number(e.pendientes||0)===1?'':'s'} · Ver viabilidad`,`staControlAbrirViabilidad(${Number(e.evento_id)},${Number(e.fecha_id)})`),'',true)+
      staControlBloque('Tareas de Producción','🎬',tareas,t=>staControlFila(t.prioridad===0?'🔴':'🟠',t.titulo,`${t.oportunidad}${t.responsable?' · '+t.responsable:''} · ${staFmtFechaCorta(t.fecha_limite)}`,`staControlAbrirProduccion(${Number(t.oportunidad_id)})`,t.prioridad===0?'danger':''),'',true)+
      staControlBloque('Alojamiento','🏨',aloj,a=>staControlFila('🏨',a.titulo,`${a.cliente} · ${staFmtFechaCorta(a.fecha_prevista)} · ${String(a.pernocta_estado||'pendiente').replaceAll('_',' ')} · Gestionar alojamiento`,`staControlAbrirAlojamiento(${Number(a.oportunidad_id)})`),'',true)+
      staControlBloque('Acciones comerciales','🤝',acciones,a=>staControlFila(a.prioridad===0?'🔴':a.prioridad===1?'🟠':'🟡',a.titulo,`${a.cliente}${a.fecha?' · '+staFmtFechaCorta(a.fecha):''}${a.detalle?' · '+a.detalle:''}`,`staCrmAbrirOportunidad(${Number(a.oportunidad_id)})`,a.prioridad===0?'danger':''),'',true)+
      staControlBloque('Presupuestos esperando respuesta','€',pres,p=>staControlFila('€',p.oportunidad,`${p.cliente} · enviado hace varios días`,`staCrmAbrirOportunidad(${Number(p.oportunidad_id)})`),'',true)+
      (total?'':'<p class="sta-hoy-clear">✅ Sin gestiones pendientes. Consulta las próximas actuaciones abajo.</p>')+
      `<h3 class="sta-hoy-heading sta-hoy-secondary">En el horizonte</h3>`+
      staControlBloque('Próximos eventos','📅',prox,e=>staControlFila('📅',e.titulo,`${staFmtFechaCorta(e.fecha)}${e.hora?' · '+staFmtHora(e.hora):''}${e.lugar?' · '+e.lugar:''}`,`staControlAbrirEncuesta(${Number(e.evento_id)},${Number(e.fecha_id)})`),'No hay eventos confirmados en los próximos 14 días.')+'</div>';
    staHoyPrepararCambios();
  }catch(e){console.error(e);body.innerHTML=`<div class="sta-sheet-intro"><strong>❌ No se ha podido cargar el centro de control.</strong><p>${escapeHtml(e.message||'')}</p></div>`;staHoyPrepararCambios()}
}
function staControlAbrirEncuesta(eventoId,fechaId){cerrarStaSheet();seleccionarEvento(Number(eventoId),'encuestas');setTimeout(()=>{if(fechaId){try{seleccionarFechaEvento?.(Number(fechaId))}catch(_){}}},250)}
async function staControlAbrirViabilidad(eventoId,fechaId){
  if(!staTienePermiso('viabilidad'))return;
  abrirGestionViabilidadEncuesta();
  await seleccionarEventoGestion(Number(eventoId));
  if(Number(fechaId)&&Number(eventoActual?.id)===Number(eventoId)&&fechasEventoActual.some(f=>Number(f.id)===Number(fechaId)))await seleccionarFechaGestor(Number(fechaId),false);
  document.getElementById('panelGestor')?.scrollTo({top:0,behavior:'auto'});
}
async function staControlAbrirProduccion(oportunidadId){
  await staCrmCargar();
  await staProdOppAbrir(Number(oportunidadId));
}
async function staControlAbrirAlojamiento(oportunidadId){
  if(!staTienePermiso('logistica'))return;
  await staCrmCargar();
  staProdOppArea='logistica';staProdOppLogTab='hotel';
  await staProdOppAbrir(Number(oportunidadId));
}

let staCrmContactosCache=[];
async function staCrmCargarContactos(clienteId){const r=await supabaseClient.rpc('crm_listar_contactos',{p_cliente_id:Number(clienteId)});if(r.error)throw r.error;staCrmContactosCache=r.data||[];return staCrmContactosCache}
function staCrmTipoContactoLabel(t){return ({general:'General',comercial:'Comercial',evento:'Evento',tecnico:'Técnico',facturacion:'Facturación',otro:'Otro'})[t]||t||'General'}
async function staCrmAbrirCliente(id){
 const c=staCrmCliente(id);if(!c)return;
 const peticion=++staCrmFichaPeticion;
 const cuerpoOrigen=document.getElementById('staSheetBody')?.firstElementChild;
 let contactos=[];
 try{contactos=await staCrmCargarContactos(id)}catch(e){console.error(e)}
 if(peticion!==staCrmFichaPeticion||document.getElementById('staSheetBackdrop')?.classList.contains('hidden')||document.getElementById('staSheetBody')?.firstElementChild!==cuerpoOrigen)return;
 const opp=staCrmOportunidades.filter(o=>Number(o.cliente_id)===Number(id));
 pushStaSheet(c.nombre,`<section class="sta-crm-client-hero"><span class="sta-crm-client-avatar">${escapeHtml((c.nombre||'C').trim().slice(0,1).toUpperCase())}</span><span><small>FICHA COMERCIAL</small><strong>${escapeHtml(c.nombre)}</strong><small>${escapeHtml(c.razon_social||'Cliente de Spirit to All')}</small></span></section>
 <div class="sta-crm-client-actions"><button class="sta-crm-add sta-crm-add-outline" type="button" onclick="staCrmEditarCliente(${Number(id)})">✎ Editar datos</button><button class="sta-crm-add sta-crm-add-primary" type="button" onclick="staCrmEditarOportunidad(null,${Number(id)})">＋ Nuevo bolo</button></div>
 <section class="sta-crm-client-summary" aria-label="Datos de contacto"><div><span>📇 Contacto</span><strong>${escapeHtml(c.contacto_nombre||'Consultar abajo')}</strong></div><div><span>✉️ Correo</span><strong>${escapeHtml(c.contacto_email||'Pendiente')}</strong></div><div><span>☎️ Teléfono</span><strong>${escapeHtml(c.contacto_telefono||'Pendiente')}</strong></div></section>
 <div class="sta-crm-section-heading"><strong>👥 Personas de contacto</strong><button class="sta-mini-edit sta-crm-add-contact" type="button" onclick="staCrmEditarContacto(null,${Number(id)})">＋ Añadir contacto</button></div>
 <div class="sta-crm-contact-list">${contactos.length?contactos.map(x=>`<button class="sta-crm-contact" onclick="staCrmEditarContacto(${Number(x.id)},${Number(id)})"><span><strong>${x.principal?'⭐ ':''}${escapeHtml(x.nombre)}</strong><small>${escapeHtml(staCrmTipoContactoLabel(x.tipo))}${x.cargo?' · '+escapeHtml(x.cargo):''}</small><small>${escapeHtml(x.email||'')}${x.telefono?(x.email?' · ':'')+escapeHtml(x.telefono):''}</small></span><b>›</b></button>`).join(''):staControlVacio('No hay contactos. Añade las personas de comercial, técnica, evento o facturación.')}</div>
 <div class="sta-crm-section-heading"><strong>💼 Bolos</strong><span>${opp.length}</span></div>
 <div class="sta-crm-fichas">${opp.length?staBolosOrdenados(opp,'bolos').map(o=>staBoloFichaLista(o,'cliente')).join(''):'<div class="sta-crm-empty">Este cliente no tiene bolos.</div>'}</div>`);
}
function staCrmEditarContacto(id,clienteId){const x=id?staCrmContactosCache.find(y=>Number(y.id)===Number(id)):{};pushStaSheet(id?'Editar contacto':'Nuevo contacto',`<div class="sta-crm-form"><label class="control-label full">Nombre<input id="crmConNombre" value="${escapeHtml(x?.nombre||'')}"></label><label class="control-label">Tipo<select id="crmConTipo"><option value="general">General</option><option value="comercial" ${x?.tipo==='comercial'?'selected':''}>Comercial</option><option value="evento" ${x?.tipo==='evento'?'selected':''}>Evento</option><option value="tecnico" ${x?.tipo==='tecnico'?'selected':''}>Técnico</option><option value="facturacion" ${x?.tipo==='facturacion'?'selected':''}>Facturación</option><option value="otro" ${x?.tipo==='otro'?'selected':''}>Otro</option></select></label><label class="control-label">Cargo / función<input id="crmConCargo" value="${escapeHtml(x?.cargo||'')}"></label><label class="control-label">Email<input id="crmConEmail" type="email" value="${escapeHtml(x?.email||'')}"></label><label class="control-label">Teléfono<input id="crmConTel" value="${escapeHtml(x?.telefono||'')}"></label><label class="control-label full">Notas<textarea id="crmConNotas">${escapeHtml(x?.notas||'')}</textarea></label><label class="control-label full"><input id="crmConPrincipal" type="checkbox" ${x?.principal?'checked':''}> Contacto principal del cliente</label></div><div id="crmConMsg" class="muted"></div><div class="sta-crm-actions"><button class="btn-primary" onclick="staCrmGuardarContacto(${id?Number(id):'null'},${Number(clienteId)})">💾 Guardar</button>${id?`<button class="btn-light danger" onclick="staCrmArchivarContacto(${Number(id)},${Number(clienteId)})">Archivar</button>`:''}</div>`)}
async function staCrmGuardarContacto(id,clienteId){const msg=document.getElementById('crmConMsg'),nombre=document.getElementById('crmConNombre')?.value.trim()||'';if(!nombre){msg.textContent='Escribe el nombre.';return}msg.textContent='Guardando…';const r=await supabaseClient.rpc('crm_guardar_contacto',{p_id:id,p_cliente_id:Number(clienteId),p_nombre:nombre,p_cargo:document.getElementById('crmConCargo')?.value.trim()||null,p_tipo:document.getElementById('crmConTipo')?.value||'general',p_email:document.getElementById('crmConEmail')?.value.trim()||null,p_telefono:document.getElementById('crmConTel')?.value.trim()||null,p_notas:document.getElementById('crmConNotas')?.value.trim()||null,p_principal:Boolean(document.getElementById('crmConPrincipal')?.checked)});if(r.error){console.error(r.error);msg.textContent='❌ '+r.error.message;return}await staCrmCargar();volverStaSheet();volverStaSheet();await staCrmAbrirCliente(clienteId)}
async function staCrmArchivarContacto(id,clienteId){if(!confirm('¿Archivar este contacto?'))return;const r=await supabaseClient.rpc('crm_archivar_contacto',{p_id:Number(id),p_archivar:true});if(r.error){alert(r.error.message);return}volverStaSheet();volverStaSheet();await staCrmAbrirCliente(clienteId)}

function staRutaEstado(label,ok,pendiente=false){return `<span class="sta-route-status ${ok?'ok':pendiente?'warn':'bad'}">${ok?'✅':pendiente?'🟠':'🔴'} ${escapeHtml(label)}</span>`}
function staRutaPendientesHtml(d){
  const o=d.oportunidad||{},c=d.cliente||{},e=d.evento||null,p=d.presupuesto||{},l=d.logistica||{},tareas=d.tareas||[],fechas=e?.fechas||[];
  const items=[];
  if(!c.contacto_nombre&&!d.contactos?.length)items.push('Añadir un contacto del cliente');
  if(!o.fecha_prevista&&!fechas.some(f=>f.fecha))items.push('Definir la fecha del bolo');
  if(!o.lugar&&!fechas.some(f=>f.lugar))items.push('Confirmar el lugar');
  const pendientes=fechas.reduce((n,f)=>n+Number(f.pendientes||0),0);
  if(pendientes)items.push(`${pendientes} respuesta${pendientes===1?'':'s'} de encuesta pendiente${pendientes===1?'':'s'}`);
  if(e&&!['viable','no_viable'].includes(d._decision||''))items.push('Dirección aún no ha publicado viabilidad');
  const abiertas=tareas.filter(t=>!['hecho','no_aplica'].includes(t.estado)).length;
  if(abiertas)items.push(`${abiertas} tarea${abiertas===1?'':'s'} de Producción por completar`);
  if(['propuesta_enviada','pendiente_respuesta','confirmado'].includes(o.estado)&&!p.id)items.push('Revisar presupuesto del bolo');
  if(o.estado==='confirmado'&&l.tecnico_sonido_estado==='pendiente')items.push('Confirmar sonido y técnico');
  if(l.pernocta_estado&&!['no_necesaria','confirmada'].includes(l.pernocta_estado))items.push('Revisar alojamiento');
  return `<section id="staRutaQueFalta" class="sta-route-pending"><h4>📌 Qué falta por revisar</h4>${items.length?`<p>Resumen orientativo de los datos del bolo. Abre los apartados de abajo para completarlos.</p><ul>${items.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:'<p>✅ No se detectan pendientes en los datos revisados. Comprueba igualmente los detalles antes del concierto.</p>'}</section>`;
}
async function staCrmAbrirHojaRuta(id,mostrarPendientes=false){
  pushStaSheet('Hoja de ruta','<div class="sta-sheet-intro"><strong>Preparando hoja de ruta…</strong></div>');
  const body=document.getElementById('staSheetBody');
  try{
    const {data,error}=await supabaseClient.rpc('crm_hoja_ruta_oportunidad',{p_oportunidad_id:Number(id)});if(error)throw error;
    const d=data||{},o=d.oportunidad||{},c=d.cliente||{},contactos=d.contactos||[],tareas=d.tareas||[],l=d.logistica||{},p=d.presupuesto||{},e=d.evento||null,fechas=e?.fechas||[];
    const tareasPend=tareas.filter(t=>!['hecho','no_aplica'].includes(t.estado));
    const valoracion=e?.id?await staConsultarDecision(Number(e.id)).catch(()=>null):null;
    d._decision=valoracion?.decision||null;
    body.innerHTML=`<div class="sta-route-hero"><div><small>HOJA DE RUTA</small><strong>${escapeHtml(o.titulo||'Evento')}</strong><p>${escapeHtml(c.nombre||'Cliente')}${o.fecha_prevista?' · '+escapeHtml(staFmtFechaCorta(o.fecha_prevista)):''}${o.lugar?' · '+escapeHtml(o.lugar):''}</p></div><button class="btn-light" onclick="window.print()">🖨️ Imprimir</button></div><div class="sta-route-statuses">${staRutaEstado('Comercial',Boolean(p.id)||o.estado==='confirmado',!p.id)}${staRutaEstado('Encuesta',Boolean(e),!e)}${valoracion?.decision?`<span class="sta-crm-badge">Dirección · ${staTextoDecision[valoracion.decision]}</span>`:''}${staRutaEstado('Producción',tareasPend.length===0,tareasPend.length>0)}${staRutaEstado('Alojamiento',l.pernocta_estado==='no_necesaria'||l.pernocta_estado==='confirmada',l.pernocta_estado==='reservada')}</div>${staRutaPendientesHtml(d)}`+
      `<div class="sta-route-grid"><section><h4>🤝 Cliente y contactos</h4><p><strong>${escapeHtml(c.nombre||'')}</strong>${c.razon_social?'<br>'+escapeHtml(c.razon_social):''}</p>${contactos.length?contactos.map(x=>`<div class="sta-route-line"><strong>${x.principal?'⭐ ':''}${escapeHtml(x.nombre)}</strong><small>${escapeHtml(staCrmTipoContactoLabel(x.tipo))}${x.cargo?' · '+escapeHtml(x.cargo):''}${x.telefono?' · '+escapeHtml(x.telefono):''}${x.email?' · '+escapeHtml(x.email):''}</small></div>`).join(''):'<p class="muted">Sin contactos registrados.</p>'}</section>`+
      `<section><h4>📅 Evento</h4>${e?`<p><strong>${escapeHtml(e.titulo)}</strong></p>${fechas.map(f=>`<div class="sta-route-line"><strong>${escapeHtml(staFmtFechaCorta(f.fecha))}${f.hora?' · '+escapeHtml(staFmtHora(f.hora)):''}</strong><small>${escapeHtml(f.lugar||'')} · ${Number(f.pendientes||0)} pendientes</small></div>`).join('')}${e.repertorio?`<div class="sta-route-note"><small>Repertorio</small>${escapeHtml(e.repertorio)}</div>`:''}`:'<p class="muted">Todavía no hay encuesta. La producción puede continuar igualmente.</p>'}</section>`+
      `<section><h4>🎬 Producción</h4>${tareas.length?tareas.map(t=>`<div class="sta-route-line"><strong>${t.estado==='hecho'?'✅':'⬜'} ${escapeHtml(t.titulo)}</strong><small>${escapeHtml(staContaAreaLabel?.(t.area)||t.area)}${t.responsable?' · '+escapeHtml(t.responsable):''}${t.fecha_limite?' · '+escapeHtml(staFmtFechaCorta(t.fecha_limite)):''}</small></div>`).join(''):'<p class="muted">Sin tareas registradas.</p>'}</section>`+
      `<section><h4>🎛️ Logística</h4><div class="sta-route-line"><strong>Sonido: ${escapeHtml(l.tecnico_sonido_estado||'pendiente')}</strong><small>${escapeHtml(l.tecnico_sonido_nombre||'Sin técnico asignado')}</small></div><div class="sta-route-line"><strong>Montaje</strong><small>${escapeHtml(l.montaje_responsables||'Sin responsables')}${l.hora_montaje?' · '+escapeHtml(staFmtHora(l.hora_montaje)):''}</small></div><div class="sta-route-line"><strong>Vestuario: ${escapeHtml(l.vestuario_estado||'pendiente')}</strong><small>${escapeHtml(l.vestuario_indicaciones||'')}</small></div>${e?.coches_url?`<a class="btn-light btn-full" href="${escapeHtml(e.coches_url)}" target="_blank" rel="noopener">🚗 Abrir organización de coches</a>`:''}</section>`+
      `<section><h4>🏨 Alojamiento</h4><div class="sta-route-line"><strong>${escapeHtml(String(l.pernocta_estado||'pendiente').replaceAll('_',' '))}</strong><small>${escapeHtml(l.hotel_nombre||'')}${l.fecha_entrada?' · '+escapeHtml(staFmtFechaCorta(l.fecha_entrada)):''}${l.fecha_salida?' → '+escapeHtml(staFmtFechaCorta(l.fecha_salida)):''}</small></div>${l.habitaciones?`<div class="sta-route-note"><small>Habitaciones</small>${escapeHtml(l.habitaciones)}</div>`:''}${l.reserva_codigo?`<div class="sta-route-note private"><small>🔐 Código de reserva</small>${escapeHtml(l.reserva_codigo)}</div>`:''}</section>`+
      `<section><h4>€ Presupuesto</h4>${p.id?`<div class="sta-route-line"><strong>${escapeHtml(staCrmEuros(p.importe))} · ${escapeHtml(p.estado||'')}</strong><small>${escapeHtml(p.concepto||'')}</small></div>`:'<p class="muted">Sin presupuesto guardado.</p>'}</section></div>`;
    if(mostrarPendientes)body.querySelector('#staRutaQueFalta')?.scrollIntoView({block:'start'});
  }catch(e){console.error(e);body.innerHTML=`<div class="sta-sheet-intro"><strong>❌ No se ha podido generar la hoja de ruta.</strong><p>${escapeHtml(e.message||'')}</p></div>`}
}

// Añadir Hoja de ruta a la ficha de oportunidad conservando el comportamiento original.
const staCrmAbrirOportunidadBase=staCrmAbrirOportunidad;
staCrmAbrirOportunidad=async function(id){await staCrmAbrirOportunidadBase(id);const body=document.getElementById('staSheetBody');if(!body)return;const actions=body.querySelector('.sta-crm-actions');if(actions&&!actions.querySelector('[data-route-btn]')){const b=document.createElement('button');b.className='btn-dark';b.type='button';b.dataset.routeBtn='1';b.textContent='📋 Hoja de ruta';b.onclick=()=>staCrmAbrirHojaRuta(Number(id));actions.insertBefore(b,actions.firstChild);const q=document.createElement('button');q.className='btn-light';q.type='button';q.textContent='📌 Qué falta';q.onclick=()=>staCrmAbrirHojaRuta(Number(id),true);actions.insertBefore(q,b.nextSibling)}};

// Integración con inicio y detalle de evento.
const staInicioAbrirCrmBase=staInicioAbrir;
staInicioAbrir=function(tipo,btn){if(tipo==='control'){staHomeMarcar(btn);abrirCentroControl();return}if(tipo==='crm'){if(!staTienePermiso('comercial'))return;staHomeMarcar(btn);abrirCrmComercial();return}return staInicioAbrirCrmBase(tipo,btn)};
