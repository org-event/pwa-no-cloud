export type LogsState = {
  text: string;
  error: string;
};

export const mountLogs = (root: HTMLElement) => {
  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Логи';
  const hint = document.createElement('p');
  hint.className = 'tagline';
  hint.textContent =
    'Сессия, ICE и ошибки. Файл app.log лежит в OPFS этого устройства.';
  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.setAttribute('role', 'alert');
  const body = document.createElement('pre');
  body.className = 'resolved logs-body';
  body.setAttribute('aria-label', 'Журнал приложения');
  panel.append(legend, hint, error, body);
  root.append(panel);

  return {
    sync(state: LogsState) {
      error.hidden = !state.error;
      error.textContent = state.error;
      body.textContent = state.text || 'Пока пусто';
    },
  };
};
