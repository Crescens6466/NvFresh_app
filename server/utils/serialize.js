// utils/serialize.js — converts a Mongoose document into a plain object with
// a string "id" field (instead of "_id"), so the API shape stays the same
// as before the MongoDB migration and the frontend needs no changes.
export function toClient(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = obj;
  if (rest.delivery_location) {
    rest.deliveryLocation = {
      latitude: rest.delivery_location.latitude,
      longitude: rest.delivery_location.longitude,
      formattedAddress: rest.delivery_location.formatted_address,
      deliveryArea: rest.delivery_location.delivery_area,
      placeId: rest.delivery_location.place_id,
      verified: Boolean(rest.delivery_location.verified),
    };
  }
  return { id: _id.toString(), ...rest };
}

export function toClientList(docs) {
  return docs.map(toClient);
}
