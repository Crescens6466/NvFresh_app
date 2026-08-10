// utils/serialize.js — converts a Mongoose document into a plain object with
// a string "id" field (instead of "_id"), so the API shape stays the same
// as before the MongoDB migration and the frontend needs no changes.
export function toClient(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = obj;
  return { id: _id.toString(), ...rest };
}

export function toClientList(docs) {
  return docs.map(toClient);
}
