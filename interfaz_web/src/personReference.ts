export type PersonReference = { id: string; full_name: string; room?: string };
export function personReference(person: PersonReference) {
  return [person.full_name, person.room?.trim(), `Ref. ${person.id.slice(0, 8)}`].filter(Boolean).join(" · ");
}
