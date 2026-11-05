import {createContext,useContext,useEffect,useLayoutEffect,useState} from 'react'
import {normalizeTheme,readTheme,resolveTheme,saveTheme,themeKey} from './themePreference.js'
const ThemeContext=createContext(null)
export const useTheme=()=>useContext(ThemeContext)
export function ThemeProvider({userId,children}){
 const [choice,setChoice]=useState(()=>{try{return readTheme(window.localStorage,userId)}catch{return 'light'}})
 const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.('(prefers-color-scheme: dark)').matches||false)
 const [notice,setNotice]=useState('')
 const resolved=resolveTheme(choice,systemDark)
 useEffect(()=>{
  const media=window.matchMedia?.('(prefers-color-scheme: dark)')
  const update=()=>setSystemDark(Boolean(media?.matches))
  update();media?.addEventListener('change',update)
  const storage=e=>{if(e.key===themeKey(userId)||e.key===null){setChoice(normalizeTheme(e.newValue));setNotice('')}}
  window.addEventListener('storage',storage)
  return()=>{media?.removeEventListener('change',update);window.removeEventListener('storage',storage)}
 },[userId])
 useLayoutEffect(()=>{
  document.documentElement.dataset.salonTheme=resolved
  return()=>{delete document.documentElement.dataset.salonTheme}
 },[resolved])
 function select(value){
  setChoice(normalizeTheme(value))
  let saved=false;try{saved=saveTheme(window.localStorage,userId,value)}catch{}
  setNotice(saved?'Izgled je spremljen za ovaj račun u ovom pregledniku.':'Izgled je promijenjen, ali ga preglednik nije mogao spremiti za sljedeći posjet.')
 }
 return <ThemeContext.Provider value={{choice,resolved,select,notice}}>{children}</ThemeContext.Provider>
}
