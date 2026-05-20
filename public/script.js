(function () {
  const config = window.APP_CONFIG || {};
  const API_BASE_URL = (config.STATS_API_URL || '').replace(/\/$/, '');

  const form = document.getElementById('stats-form');
  const submitButton = document.getElementById('submit-button');
  const error = document.getElementById('form-error');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const notFoundState = document.getElementById('not-found-state');
  const dashboard = document.getElementById('dashboard');
  const visitsList = document.getElementById('visits-list');
  let refreshTimer = null;

  const setVisible = (element, visible) => {
    element.classList.toggle('hidden', !visible);
  };

  const setState = (state) => {
    setVisible(emptyState, state === 'empty');
    setVisible(loadingState, state === 'loading');
    setVisible(notFoundState, state === 'not-found');
    setVisible(dashboard, state === 'dashboard');
  };

  const formatDateTime = (value) => {
    if (!value) return 'Sin registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const renderVisits = (visits) => {
    visitsList.innerHTML = '';

    if (!visits.length) {
      const item = document.createElement('li');
      item.textContent = 'No hay visitas en el rango seleccionado.';
      visitsList.appendChild(item);
      return;
    }

    visits
      .slice()
      .reverse()
      .slice(0, 12)
      .forEach((visit, index) => {
        const item = document.createElement('li');
        const position = document.createElement('span');
        const timestamp = document.createElement('span');

        position.textContent = `Visita ${visits.length - index}`;
        timestamp.textContent = formatDateTime(visit);

        item.append(position, timestamp);
        visitsList.appendChild(item);
      });
  };

  const renderDashboard = (data, filters) => {
    document.getElementById('total-clicks').textContent = data.clicks || 0;
    document.getElementById('filtered-clicks').textContent = data.filteredClicks || 0;
    document.getElementById('visit-count').textContent = (data.visits || []).length;
    document.getElementById('detail-short-id').textContent = data.shortId;
    document.getElementById('created-at').textContent = formatDateTime(data.createdAt);

    const originalUrl = document.getElementById('original-url');
    originalUrl.href = data.originalUrl;
    originalUrl.textContent = data.originalUrl;

    const rangeParts = [];
    if (filters.startDate) rangeParts.push(`desde ${filters.startDate}`);
    if (filters.endDate) rangeParts.push(`hasta ${filters.endDate}`);
    document.getElementById('range-label').textContent = rangeParts.length ? rangeParts.join(' ') : 'Sin filtro de fechas';

    renderVisits(data.visits || []);
    setState('dashboard');
  };

  const stopAutoRefresh = () => {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  const startAutoRefresh = (url, filters) => {
    stopAutoRefresh();
    refreshTimer = window.setInterval(() => {
      loadStats(url, filters, { silent: true });
    }, 5000);
  };

  const normalizeShortId = (value) => {
    const input = value.trim();
    if (!input) return '';

    try {
      const parsed = new URL(input);
      const parts = parsed.pathname.split('/').filter(Boolean);
      const shortIndex = parts.indexOf('short');

      if (shortIndex >= 0 && parts[shortIndex + 1]) {
        return decodeURIComponent(parts[shortIndex + 1]);
      }

      return decodeURIComponent(parts[parts.length - 1] || '');
    } catch {
      return input.replace(/^\/+|\/+$/g, '');
    }
  };

  const loadStats = async (url, filters, options = {}) => {
    try {
      const response = await fetch(url);

      if (response.status === 404) {
        stopAutoRefresh();
        setState('not-found');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      renderDashboard(data, filters);

      if (!options.silent) {
        startAutoRefresh(url, filters);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      if (options.silent) return;
      error.textContent = 'No pudimos cargar las estadisticas. Revisa la API o intenta de nuevo.';
      stopAutoRefresh();
      setState('empty');
    } finally {
      submitButton.disabled = false;
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    stopAutoRefresh();

    if (!API_BASE_URL) {
      error.textContent = 'Configura STATS_API_URL en public/config.js o en el workflow de despliegue.';
      return;
    }

    const formData = new FormData(form);
    const shortId = normalizeShortId(String(formData.get('shortId') || ''));
    const startDate = String(formData.get('startDate') || '').trim();
    const endDate = String(formData.get('endDate') || '').trim();

    if (!shortId) {
      error.textContent = 'Ingresa el codigo corto que quieres consultar.';
      return;
    }

    const params = new URLSearchParams();
    if (startDate) params.set('startDate', new Date(`${startDate}T00:00:00`).toISOString());
    if (endDate) params.set('endDate', new Date(`${endDate}T23:59:59`).toISOString());

    const query = params.toString();
    const url = `${API_BASE_URL}/stats/${encodeURIComponent(shortId)}${query ? `?${query}` : ''}`;

    setState('loading');
    submitButton.disabled = true;
    await loadStats(url, { startDate, endDate });
  });

  setState('empty');
})();
