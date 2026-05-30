import type { EnvSuggestState } from '../hooks/useEnvVarSuggest';
import { t } from '../i18n';

type Props = {
  suggest: EnvSuggestState;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onPick: (name: string) => void;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function EnvVarSuggestList({
  suggest,
  activeIndex,
  onActiveIndexChange,
  onPick,
  id,
  className = 'env-var-suggest',
  style,
}: Props) {
  return (
    <ul id={id} className={className} style={style} role="listbox">
      {suggest.list.map((row, idx) => (
        <li
          key={row.name}
          role="option"
          aria-selected={idx === activeIndex}
          className={idx === activeIndex ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(idx)}
          onClick={() => onPick(row.name)}
          title={row.value !== '' ? `${row.name} = ${row.value}` : row.name}
        >
          <span className="env-var-suggest-name">{row.name}</span>
          {row.builtin && (
            <span className="env-var-suggest-badge">{t('env.builtinTag')}</span>
          )}
          {row.value !== '' && (
            <>
              <span className="env-var-suggest-sep" aria-hidden>
                ·
              </span>
              <span className="env-var-suggest-value">{row.value}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
