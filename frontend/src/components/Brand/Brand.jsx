import mark from './assets/zrihtan-mark.png'
import './Brand.css'

export default function Brand({ compact = false }) {
  return <span className="zrihtan-brand" data-compact={compact || undefined}>
    <img className="zrihtan-brand-mark" src={mark} alt="" aria-hidden="true" width="36" height="36" draggable="false" />
    <span className="zrihtan-brand-name">ZRIHTAN</span>
  </span>
}
