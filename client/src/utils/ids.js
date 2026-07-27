/** Normalize user/entity id whether API returns id or legacy _id */
export function uid(entity) {
  if (!entity) return null
  if (typeof entity === 'string') return entity
  return entity.id || entity._id || null
}

export function withIdAlias(entity) {
  if (!entity) return entity
  const id = uid(entity)
  return { ...entity, id, _id: id }
}
