"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {evaluate}=require("../tools/evaluate-boundary");
test("qualified synthetic result is never a claim about Siri",()=>{
 const r=evaluate({testHost:"aies-probe.invalid",scriptBody:"AIES_BOUNDARY_PROBE_OK",
   hostMapping:"127.0.0.1",independentNetworkObservation:true,nonLoopbackOutboundObserved:false});
 assert.equal(r.status,"PROBE_PASS");assert.equal(r.siriReady,false);
});
test("Safari-only success is inconclusive",()=>{
 assert.equal(evaluate({testHost:"aies-probe.invalid",scriptBody:"AIES_BOUNDARY_PROBE_OK",
   hostMapping:"127.0.0.1"}).status,"INCONCLUSIVE");
});
test("any observed non-loopback connection fails the transport experiment",()=>{
 assert.equal(evaluate({testHost:"aies-probe.invalid",nonLoopbackOutboundObserved:true,
   scriptBody:"AIES_BOUNDARY_PROBE_OK"}).status,"FAIL");
});
test("real origin and missing script response cannot pass",()=>{
 assert.equal(evaluate({testHost:"prod-yabuli.qianwen.com"}).status,"INVALID");
 assert.equal(evaluate({testHost:"aies-probe.invalid",scriptBody:"404"}).status,"INCONCLUSIVE");
});
