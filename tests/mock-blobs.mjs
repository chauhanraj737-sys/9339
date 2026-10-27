const values=new Map();
export function getStore() {return {
 get:async key=>structuredClone(values.get(key)??null),
 setJSON:async(key,value)=>{values.set(key,structuredClone(value));},
 delete:async key=>{values.delete(key);},
 list:async({prefix})=>({blobs:[...values.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))})
};}
