import {useLanguage} from '../Language/LanguageProvider'
import {shellText} from '../Language/shellText.js'
import {useTheme} from './ThemeProvider'
const choices=[['light','Svijetlo','Biserna pozadina i svijetle kartice.'],['dark','Tamno','Ponoćnoplave površine i nježniji kontrast.'],['system','Prema uređaju','Prati postavku izgleda vašeg uređaja.']]
export default function AppearanceSettings(){
 const {language} = useLanguage()
 const f = source => shellText(language,source)

 const theme=useTheme()
 if(!theme)return null
 return <section className="settings-panel appearance-settings" aria-labelledby="appearance-heading"><h2 id="appearance-heading">{f("Izgled aplikacije")}</h2><p>{f("Odaberite temu koja vam najbolje odgovara. Izbor vrijedi za vaš račun u ovom pregledniku.")}</p><fieldset className="appearance-options"><legend className="appearance-legend">{f("Tema aplikacije")}</legend>{choices.map(([value,label,description])=><label className="appearance-option" key={value} data-selected={theme.choice===value}><input type="radio" name="salon-appearance" value={value} checked={theme.choice===value} onChange={()=>theme.select(value)}/><span className={'appearance-preview appearance-preview-'+value} aria-hidden="true"><i/><b/><b/></span><strong>{f(label)}</strong><small>{f(description)}</small></label>)}</fieldset><p className="appearance-notice" role="status">{f(theme.notice)}</p></section>
}
