export const THEME_OPTIONS=['light','dark','system']
export const normalizeTheme=value=>THEME_OPTIONS.includes(value)?value:'light'
export const resolveTheme=(value,dark)=>normalizeTheme(value)==='system'?(dark?'dark':'light'):normalizeTheme(value)
export const themeKey=userId=>userId===null||userId===undefined||String(userId)===''?null:'salonai:appearance:v1:'+String(userId)
export function readTheme(storage,userId){try{const key=themeKey(userId);return key?normalizeTheme(storage.getItem(key)):'light'}catch{return 'light'}}
export function saveTheme(storage,userId,value){const key=themeKey(userId);if(!key||!THEME_OPTIONS.includes(value))return false;try{storage.setItem(key,value);return true}catch{return false}}
