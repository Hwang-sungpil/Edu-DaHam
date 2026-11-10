const {config,load,store,role,scopeData,respond,error}=require('./_lib');
module.exports=async(req,res)=>{try{
 if(req.method!=='POST')return respond(res,405,{error:'POST 전용'});
 if(!config())return respond(res,503,{error:'Notion 연결 미설정'});
 const {page,data}=await load();const auth=role(req,data);
 if(!auth||!['admin','clerk'].includes(auth.role))return respond(res,403,{error:'서무담당자만 일괄 변경할 수 있습니다.'});
 const {trainingId,assignmentIds,completed,completedAt,dates}=req.body||{};
 if(typeof trainingId!=='string'||!Array.isArray(assignmentIds)||!assignmentIds.length||assignmentIds.length>500||typeof completed!=='boolean'||!assignmentIds.every(x=>typeof x==='string'))return respond(res,400,{error:'변경 요청 형식 오류'});
 if(!data.trainings.some(t=>t.id===trainingId))return respond(res,404,{error:'교육을 찾을 수 없습니다.'});
 if(auth.role==='clerk'&&data.trainings.find(t=>t.id===trainingId)?.department!==auth.department)return respond(res,403,{error:'다른 부서 교육 수정 금지'});const ids=new Set(assignmentIds);const found=data.assignments.filter(a=>a.trainingId===trainingId&&ids.has(a.id));
 if(auth.role==='clerk'&&found.some(a=>data.employees.find(e=>e.id===a.employeeId)?.department!==auth.department))return respond(res,403,{error:'다른 부서 직원 수정 금지'});if(found.length!==ids.size)return respond(res,400,{error:'교육 대상자 목록이 올바르지 않습니다.'});
 const valid=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00').getTime());
 const today=new Date().toISOString().slice(0,10);for(const a of found){const day=dates?.[a.id]||completedAt||today;if(completed&&!valid(day))return respond(res,400,{error:'수료일 형식 오류'});a.completed=completed;a.completedAt=completed?day:''}
 await store(data,page);return respond(res,200,{data:scopeData(data,auth,auth.role==='clerk'?auth.department:String(req.body?.department||''))});
 }catch(e){error(res,e)};
};
