const crypto=require('crypto');
const {config,load,store,role,respond,error}=require('./_lib');
module.exports=async(req,res)=>{try{
 if(req.method!=='POST')return respond(res,405,{error:'POST 전용'});
 if(!config())return respond(res,503,{error:'Notion 연결 미설정'});
 const {page,data}=await load();const auth=role(req,data);
 if(!auth||!['admin','clerk'].includes(auth.role))return respond(res,403,{error:'링크 관리 권한 없음'});
 const id=String(req.body?.employeeId||'');const action=String(req.body?.action||'issue');
 if(!['issue','rotate','revoke'].includes(action))return respond(res,400,{error:'잘못된 요청'});
 const employee=data.employees.find(e=>e.id===id);
 if(!employee)return respond(res,404,{error:'직원정보 없음'});
 if(auth.role==='clerk'&&employee.department!==auth.department)return respond(res,403,{error:'다른 부서 링크 관리 금지'});
 if(employee.active===false)return respond(res,400,{error:'비재직 직원에게 링크를 발급할 수 없습니다.'});
 if(action==='revoke')employee.token='';
 else if(action==='rotate'||!employee.token)employee.token=crypto.randomBytes(32).toString('hex');
 await store(data,page);
 return respond(res,200,{employeeId:id,hasLink:!!employee.token,token:action==='revoke'?'':employee.token});
}catch(e){error(res,e)}};
