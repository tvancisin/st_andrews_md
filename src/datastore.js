import { json } from "d3";

export function loadPeople() {
  return json(`${import.meta.env.BASE_URL}md_other_unis.json`);
}

export function loadTestimonials() {
  return json(`${import.meta.env.BASE_URL}md_testimonials.json`);
}
