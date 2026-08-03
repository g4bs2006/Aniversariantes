// App dedicado à Oral Foz — sem seletor de clínica, sem multi-tenant na UI.
// As rotas de API continuam aceitando "clinica" por parâmetro (schema já
// suporta multi-clínica no banco), mas o frontend sempre usa este slug fixo.
export const CLINICA_SLUG = 'oral-foz'
