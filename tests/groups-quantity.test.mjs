import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleBill,calculateBill,validateStore,validateGroup} from '../docs/core.js';
test('quantity multiplies both consumption and payment exactly',()=>{
 const b=sampleBill(); b.items=[{...b.items[0],amount:50000,quantity:3}];
 const r=calculateBill(b); assert.equal(r.total,150000); assert.equal(r.people[0].paid,150000); assert.equal(r.people.reduce((s,p)=>s+p.owed,0),150000);
});
test('invalid quantities and oversized line totals rejected',()=>{
 for(const quantity of [0,-1,1.5,1000,NaN]){const b=sampleBill();b.items[0].quantity=quantity;assert.throws(()=>calculateBill(b));}
 const b=sampleBill();b.items[0].amount=1e9;b.items[0].quantity=2;assert.throws(()=>calculateBill(b));
});
test('old backups migrate without changing debts',()=>{
 const b=sampleBill();const original=calculateBill(b);const migrated=validateStore({version:1,bills:[b]});
 assert.equal(migrated.version,2);assert.deepEqual(migrated.groups,[]);assert.equal(migrated.bills[0].items[0].quantity,1);assert.deepEqual(calculateBill(migrated.bills[0]),original);
});
test('ten-person groups roundtrip independently of bills',()=>{
 const group={id:'g',name:'Friends',members:Array.from({length:10},(_,i)=>({id:String(i),name:`Friend ${i+1}`}))};
 const original={version:2,groups:[group],bills:[sampleBill()]}; const restored=validateStore(JSON.parse(JSON.stringify(original)));
 assert.deepEqual(restored.groups,[group]); restored.groups[0].members[0].name='Changed';assert.equal(group.members[0].name,'Friend 1');
});
test('invalid groups, duplicate IDs and unknown backups rejected',()=>{
 assert.throws(()=>validateGroup({id:'g',name:'Group',members:[]}));
 const g={id:'g',name:'Group',members:[{id:'a',name:'A'},{id:'b',name:'a'}]};assert.throws(()=>validateGroup(g));g.members.pop();
 assert.throws(()=>validateStore({version:2,bills:[],groups:[g,g]}));assert.throws(()=>validateStore({version:3,bills:[],groups:[]}));assert.throws(()=>validateStore({version:2,bills:[]}));
});
