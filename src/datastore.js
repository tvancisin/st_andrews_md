import { json } from "d3";

export function loadPeople() {
  return json(`${import.meta.env.BASE_URL}st_andrews_md.json`);
}
