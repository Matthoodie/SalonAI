export const BUSINESS_CHOICES=Object.freeze(['hair','grooming'])
export function businessTypeLabel(type,language='hr') {
 const labels=language==='en'?{hair:'Hair salons and barbershops',grooming:'Pets',mixed:'Multiple activities (previous selection)',other:'Other (previous selection)'}:{hair:'Frizerski salon i brijačnice',grooming:'Ljubimci',mixed:'Više djelatnosti (prethodni izbor)',other:'Drugo (prethodni izbor)'}
 return labels[type]||(language==='en'?'Not selected':'Nije odabrano')
}
