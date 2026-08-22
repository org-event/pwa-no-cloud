export const mountPlaceholder = (
  root: HTMLElement,
  title: string,
  text: string,
) => {
  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = title;
  const hint = document.createElement('p');
  hint.className = 'tagline';
  hint.textContent = text;
  panel.append(legend, hint);
  root.append(panel);
};
