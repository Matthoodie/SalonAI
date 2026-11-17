import {useLanguage} from '../Language/LanguageProvider'
import {BUSINESS_CHOICES,businessTypeLabel} from './businessTypes.js'
export default function BusinessTypeSelect({value,...props}) {
 const {language}=useLanguage(),legacy=value&&!BUSINESS_CHOICES.includes(value)
 return <select {...props} value={value??''}>
  <option value="" disabled>{language==='en'?'Select an activity':'Odaberite djelatnost'}</option>
  {legacy&&<option value={value} disabled>{businessTypeLabel(value,language)}</option>}
  {BUSINESS_CHOICES.map(type=><option key={type} value={type}>{businessTypeLabel(type,language)}</option>)}
 </select>
}
