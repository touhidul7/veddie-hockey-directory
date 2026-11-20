const router=require('express').Router();
const {record,clientEvents}=require('../services/analytics');
router.post('/',async(req,res)=>{
  if(process.env.ANALYTICS_ENABLED!=='true')return res.sendStatus(204);
  const input=req.body;
  if(!input||input.consent!==true||!clientEvents.has(input.event)||Object.keys(input).some(key=>!['event','consent'].includes(key)))return res.status(400).json({error:'Only consented, predefined event counters are accepted.'});
  await record(input.event);res.sendStatus(204);
});
module.exports=router;
