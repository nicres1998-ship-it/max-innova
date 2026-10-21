'use strict';
// Solo muestra controles. Toda autorización y validación ocurre en el servidor.
(function(){
 const tables={max_innova_solicitudes:'Solicitudes',max_innova_solicitudes_contacto:'Contactos y citas',max_innova_clientes_asesor:'Clientes',max_innova_expedientes_asesor:'Expedientes',max_innova_notas_asesor:'Notas',max_innova_tareas_asesor:'Seguimientos',max_innova_cotizaciones:'Cotizaciones',max_innova_operaciones:'Operaciones',max_innova_creditos:'Créditos',max_innova_pagos:'Pagos y recibos',max_innova_documentos_asesor:'Documentos internos',max_innova_estados_cuenta:'Estados de cuenta',max_innova_bitacora:'Auditoría',max_portal_documents:'Documentos del cliente',max_portal_accounts:'Accesos de clientes',max_innova_usuarios:'Usuarios internos'};
 const sections={solicitudes:'max_innova_solicitudes',web:'max_innova_solicitudes_contacto',citas:'max_innova_solicitudes_contacto',clientes:'max_innova_clientes_asesor',asignaciones:'max_innova_clientes_asesor',cotizaciones:'max_innova_cotizaciones',operaciones:'max_innova_operaciones',pagos:'max_innova_pagos',documentos:'max_innova_documentos_asesor',seguimientos:'max_innova_tareas_asesor',estados:'max_innova_estados_cuenta',bitacora:'max_innova_bitacora',usuarios:'max_innova_usuarios',portalclientes:'max_portal_accounts'};
 let selected='max_innova_solicitudes',offset=0,busy=false,inventory=null;
 async function rpc(action,extra={}){const r=await db.rpc('max_admin_manage',{p_action:action,...extra});if(r.error)throw Error(r.error.message);return r.data;}
 modules.push(['limpieza','⌫','ELIMINAR / VACIAR DATOS']);
 const previousView=view;
 view=async function(v){if(v!=='limpieza')return previousView(v);current=v;renderNav();loading();try{await manager();}catch(e){content.innerHTML='<div class="notice">No se pudo abrir el control. Instala 01_INSTALAR_LIMPIEZA.sql en Supabase.<br>'+esc(e.message)+'</div>';}};
 const previousTable=tableHtml;
 tableHtml=function(rows,fields,action){
  let table=sections[current];
  if(rows?.length&&rows[0].account_id&&rows[0].storage_path)table='max_portal_documents';
  if(!table||!rows?.length)return previousTable(rows,fields,action);
  return previousTable(rows,fields,x=>{const original=action?action(x):'';if(!x.id||!/^[a-z0-9-]+$/i.test(String(x.id)))return original;
   if(table==='max_innova_usuarios'&&String(x.rol).toUpperCase()==='ADMIN')return original+' <span class="muted">ADMIN protegido</span>';
   return original+' <button class="btn bad" onclick="adminDeleteRecord(\''+table+'\',\''+x.id+'\')">ELIMINAR</button>';});
 };
 async function manager(){
  inventory=await rpc('inventory');
  setHead('Eliminar y vaciar datos','Control exclusivo de Administración');
  const opts=inventory.tablas.map(t=>'<option value="'+t.tabla+'" '+(t.tabla===selected?'selected':'')+'>'+esc(tables[t.tabla]||t.tabla)+' ('+t.registros+')</option>').join('');
  content.innerHTML='<div class="card"><h3>ELIMINAR REGISTROS</h3><p>Selecciona un módulo. Si tiene registros relacionados, elimina primero esos registros. Los administradores están protegidos.</p><select id="admCleanTable">'+opts+'</select><div id="admCleanRows"></div><div class="toolbar"><button class="btn alt" id="admCleanPrev">ANTERIOR</button><button class="btn alt" id="admCleanNext">SIGUIENTE</button></div></div><div class="card"><h3>ARCHIVOS Y ACCESOS PENDIENTES</h3><p id="admCleanProgress">'+Number(inventory.pendientes)+' tareas de eliminación pendientes.</p><button class="btn alt" id="admCleanFinish">COMPLETAR ELIMINACIÓN DE ARCHIVOS Y ACCESOS</button></div><div class="card"><h3>EMPEZAR SIN DATOS DE OPERACIÓN</h3><p>Vacía solicitudes, clientes, expedientes, cotizaciones, operaciones, pagos, citas, seguimientos, documentos, auditoría y accesos de clientes. Conserva usuarios internos, administradores, catálogo vehicular y configuración.</p><p>Los archivos pendientes se borran mediante la función segura. Los documentos ya descargados fuera de la plataforma no se pueden retirar.</p><button class="btn bad" id="admCleanReset">REVISAR VACIADO GENERAL</button></div>';
  $('admCleanTable').onchange=()=>{selected=$('admCleanTable').value;offset=0;listRows();};
  $('admCleanPrev').onclick=()=>{offset=Math.max(0,offset-100);listRows();};
  $('admCleanNext').onclick=()=>{offset+=100;listRows();};
  $('admCleanFinish').onclick=finish;
  $('admCleanReset').onclick=reviewReset;
  await listRows();
 }
 async function listRows(){try{const r=await rpc('list',{p_table:selected,p_offset:offset});const rows=r.registros||[];
  $('admCleanRows').innerHTML=previousTable(rows,['id'],x=>{const summary=[x.nombre,x.username,x.usuario,x.folio,x.folio_cliente,x.titulo,x.nombre_archivo,x.estatus,x.categoria,x.accion].filter(Boolean).map(esc).join(' · ');
   return summary+' '+(selected==='max_innova_usuarios'&&String(x.rol).toUpperCase()==='ADMIN'?'<b>ADMIN protegido</b>':'<button class="btn bad" onclick="adminDeleteRecord(\''+selected+'\',\''+esc(String(x.id))+'\')">ELIMINAR</button>');});
  $('admCleanPrev').disabled=offset===0;$('admCleanNext').disabled=rows.length<100;
 }catch(e){$('admCleanRows').textContent=e.message;}}
 window.adminDeleteRecord=function(table,id){if(busy||!tables[table])return;
  openModal('ELIMINAR · '+tables[table],'<p>Se eliminará este registro de forma permanente. Si tiene archivos o un acceso asociado, se procesarán también. Las dependencias se comprobarán antes de borrar.</p><p>ID: '+esc(String(id))+'</p><label>Escribe ELIMINAR<input id="admDeletePhrase" autocomplete="off"></label><button class="btn bad" id="admDeleteAccept">ELIMINAR DEFINITIVAMENTE</button><div id="admDeleteMsg" role="status"></div>');
  $('admDeleteAccept').onclick=async function(){if($('admDeletePhrase').value!=='ELIMINAR'){$('admDeleteMsg').textContent='Escribe ELIMINAR para confirmar.';return;}busy=true;this.disabled=true;
   try{await rpc('delete',{p_table:table,p_id:String(id),p_confirm:'ELIMINAR'});closeModal();const result=await drain();alert(result.pending?'Registro eliminado. Hay archivos o accesos pendientes: '+result.pending+'. Reintenta desde ELIMINAR / VACIAR DATOS.':'Registro eliminado; sin tareas pendientes de archivos o accesos.');await view(current);}
   catch(e){const m=$('admDeleteMsg');if(m)m.textContent=e.message;else alert(e.message);this.disabled=false;}finally{busy=false;}};
 };
 async function drain(){
  for(let i=0;i<50;i++){
   const {data,error}=await db.functions.invoke('max-admin-cleanup',{body:{action:'drain'}});
   if(error||!data){return {pending:'por comprobar; instala o revisa max-admin-cleanup'};}
   const label=$('admCleanProgress');if(label)label.textContent='Tareas pendientes: '+data.pending;
   if(data.error)return {pending:'por comprobar: '+data.error};
   if(data.pending===0)return {pending:0};
   if(!data.completed||data.errors?.length)return {pending:data.pending};
  }
  return {pending:'hay más tareas; pulsa COMPLETAR ELIMINACIÓN para continuar'};
 }
 async function finish(){if(busy)return;busy=true;this.disabled=true;try{const r=await drain();alert(r.pending?'Quedan tareas pendientes: '+r.pending:'Eliminación de archivos y accesos terminada.');await manager();}catch(e){alert(e.message);}finally{busy=false;this.disabled=false;}}
 async function reviewReset(){if(busy)return;try{const inv=await rpc('inventory');const rows=inv.tablas.filter(x=>x.vaciar);const summary=rows.map(t=>'<li>'+esc(tables[t.tabla]||t.tabla)+': '+Number(t.registros)+'</li>').join('');
  openModal('REVISAR VACIADO GENERAL','<p>Se eliminarán permanentemente los siguientes registros:</p><ul>'+summary+'</ul><p>Archivos en los cuatro repositorios de clientes: '+Number(inv.archivos)+'. Se conservan usuarios internos, catálogo y configuración.</p><p>No captures nuevos datos ni subas archivos mientras se ejecuta el vaciado.</p><label>Escribe VACIAR MAX INNOVA<input id="admResetPhrase" autocomplete="off"></label><button class="btn bad" id="admResetAccept">VACIAR DATOS DE OPERACIÓN</button><div id="admResetMsg" role="status"></div>');
  $('admResetAccept').onclick=async function(){if($('admResetPhrase').value!=='VACIAR MAX INNOVA'){$('admResetMsg').textContent='Escribe la frase completa para confirmar.';return;}busy=true;this.disabled=true;
   try{const result=await rpc('reset',{p_confirm:'VACIAR MAX INNOVA'});$('admResetMsg').textContent='Registros vaciados: '+result.eliminados+'. Borrando archivos y accesos…';const files=await drain();closeModal();alert(files.pending?'Registros vaciados; quedan tareas pendientes: '+files.pending:'Vaciado terminado. Se eliminaron los registros y se completó la cola de archivos y accesos.');for(const key of ['_apps','_clients','_web','_users','_advisors'])delete window[key];await manager();}
   catch(e){const m=$('admResetMsg');if(m)m.textContent=e.message;else alert(e.message);this.disabled=false;}finally{busy=false;}};
 }catch(e){alert(e.message);}}
})();
