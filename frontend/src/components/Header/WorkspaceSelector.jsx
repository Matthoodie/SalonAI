import {useLanguage} from '../Language/LanguageProvider'
import {shellText} from '../Language/shellText.js'
export default function WorkspaceSelector({workspaces,currentSalonId,busy,onSelect}) {
 const {language}=useLanguage()
 return <div className="workspace-select"><label htmlFor="active-salon">{shellText(language,'Salon')}</label>
 <select id="active-salon" value={currentSalonId==null?'':String(currentSalonId)} disabled={busy} onChange={event=>onSelect(event.target.value)}>
 <option value="" disabled>{shellText(language,'Odaberite salon')}</option>
 {workspaces.map(({salon})=><option key={salon.id} value={String(salon.id)}>{salon.name}</option>)}
 </select></div>
}
