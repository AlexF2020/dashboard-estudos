// State Management
let allData = [];
let filteredData = [];
let summaryData = {};
let currentPage = 1;
const pageSize = 12;
let sortColumn = 'data';
let sortDirection = 'desc';
let currentTheme = localStorage.getItem('study_dashboard_theme') || 'dark';
let listenersAttached = false;

// Chart Instances
let chartTimeline = null;
let chartPilares = null;
let chartDisciplinas = null;
let chartHabitos = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme immediately
  document.documentElement.setAttribute('data-theme', currentTheme);

  // Se estiver em servidor HTTP/HTTPS (GitHub Pages, localhost), busca JSON fresco com cache-busting
  const isHttp = window.location.protocol.startsWith('http');
  if (isHttp) {
    fetch(`study_data.json?t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        allData = data.records || [];
        summaryData = data.summary || {};
        initDashboard();
      })
      .catch(err => {
        console.warn('Falha no fetch inicial do JSON, utilizando window.STUDY_DATA:', err);
        carregarDadosLocais();
      });
  } else {
    // Protocolo file:// ou standalone offline
    carregarDadosLocais();
  }
});

function carregarDadosLocais() {
  if (typeof window.STUDY_DATA !== 'undefined' && window.STUDY_DATA.records) {
    allData = window.STUDY_DATA.records;
    summaryData = window.STUDY_DATA.summary || {};
  }
  initDashboard();
}

function initDashboard() {
  updateThemeUI();
  populateMonthFilter();
  updateMetadataUI();
  setupEventListeners();
  initCharts();
  applyFilters();
  window.addEventListener('resize', resizeCharts);
}

// Theme Handling
function updateThemeUI() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const iconSpan = document.getElementById('themeIcon');
  const textSpan = document.getElementById('themeText');

  if (currentTheme === 'light') {
    if (iconSpan) {
      iconSpan.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
    }
    if (textSpan) textSpan.textContent = 'Modo Escuro';
  } else {
    if (iconSpan) {
      iconSpan.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
    }
    if (textSpan) textSpan.textContent = 'Modo Claro';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('study_dashboard_theme', currentTheme);
  updateThemeUI();
  initCharts();
  updateCharts();
}

// Colors according to theme
function getThemeColors() {
  const isLight = currentTheme === 'light';
  return {
    text: isLight ? '#475569' : '#94a3b8',
    heading: isLight ? '#0f172a' : '#ffffff',
    tooltipBg: isLight ? '#ffffff' : '#1f293d',
    tooltipText: isLight ? '#0f172a' : '#f8fafc',
    tooltipBorder: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
    splitLine: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)',
    axisLine: isLight ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.1)',
    pieBorder: isLight ? '#ffffff' : '#111827'
  };
}

// Populate Month dropdown dynamically
function populateMonthFilter() {
  const mesSelect = document.getElementById('filterMes');
  if (!mesSelect) return;
  
  mesSelect.innerHTML = '<option value="ALL">Todos os Meses</option>';
  const meses = [...new Set(allData.map(r => r.mes_ano).filter(Boolean))].sort((a, b) => {
    const [ma, ya] = a.split('/').map(Number);
    const [mb, yb] = b.split('/').map(Number);
    return (ya * 12 + ma) - (yb * 12 + mb);
  });

  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = formatMonthName(m);
    mesSelect.appendChild(opt);
  });
}

function formatMonthName(mesAno) {
  const [m, y] = mesAno.split('/');
  const mesesNomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(m, 10) - 1;
  return `${mesesNomes[idx]} / ${y}`;
}

// Update Metadata & Last Update Indicators
function updateMetadataUI() {
  const ultimaAtualizacaoEl = document.getElementById('ultimaAtualizacaoTexto');
  const footerAtualizacaoEl = document.getElementById('footerUltimaAtualizacao');
  const footerSessaoEl = document.getElementById('footerUltimaSessao');
  const pillEl = document.getElementById('ultimaAtualizacaoPill');

  // Determinar data da última atualização da carga
  let dataAtualizacao = summaryData.data_atualizacao;
  if (!dataAtualizacao) {
    if (summaryData.data_fim) {
      dataAtualizacao = summaryData.data_fim;
    } else if (allData.length > 0) {
      const sorted = [...allData].sort((a, b) => a.data.localeCompare(b.data));
      dataAtualizacao = sorted[sorted.length - 1].data_formatada;
    } else {
      dataAtualizacao = 'Indisponível';
    }
  }

  // Determinar última sessão registrada
  const ultimaSessao = summaryData.ultima_sessao || (allData.length > 0 ? [...allData].sort((a, b) => a.data.localeCompare(b.data)).pop().data_formatada : 'Indisponível');
  const modPlanilha = summaryData.data_modificacao_planilha || '';

  if (ultimaAtualizacaoEl) {
    ultimaAtualizacaoEl.textContent = dataAtualizacao;
  }

  if (footerAtualizacaoEl) {
    footerAtualizacaoEl.textContent = dataAtualizacao;
  }

  if (footerSessaoEl) {
    footerSessaoEl.textContent = ultimaSessao;
  }

  if (pillEl) {
    let tooltip = `Base de dados atualizada em: ${dataAtualizacao}`;
    if (modPlanilha) {
      tooltip += ` | Planilha Excel: ${modPlanilha}`;
    }
    if (ultimaSessao) {
      tooltip += ` | Última sessão de estudo: ${ultimaSessao}`;
    }
    pillEl.setAttribute('title', tooltip);
  }
}

// Reload Data dynamically (from study_data.json)
function reloadData() {
  const reloadBtn = document.getElementById('btnReloadData');
  if (reloadBtn) {
    reloadBtn.classList.add('loading');
    reloadBtn.disabled = true;
  }

  fetch(`study_data.json?t=${Date.now()}`)
    .then(res => {
      if (!res.ok) throw new Error(`Status ${res.status}`);
      return res.json();
    })
    .then(data => {
      allData = data.records || [];
      summaryData = data.summary || {};
      populateMonthFilter();
      updateMetadataUI();
      applyFilters();
      showToast('Dados e data de atualização sincronizados com sucesso!');
    })
    .catch(err => {
      console.warn('Falha no fetch JSON, verificando window.STUDY_DATA:', err);
      if (typeof window.STUDY_DATA !== 'undefined' && window.STUDY_DATA.records) {
        allData = window.STUDY_DATA.records;
        summaryData = window.STUDY_DATA.summary || {};
        updateMetadataUI();
        applyFilters();
        showToast('Dados sincronizados do script local!');
      } else {
        showToast('Não foi possível recarregar os dados.', true);
      }
    })
    .finally(() => {
      if (reloadBtn) {
        reloadBtn.classList.remove('loading');
        reloadBtn.disabled = false;
      }
    });
}

let toastTimeout = null;
function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;

  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.style.borderColor = isError ? 'var(--accent-rose)' : 'var(--accent-emerald)';
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Event Listeners for Filters
function setupEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const themeBtn = document.getElementById('btnThemeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }

  const reloadBtn = document.getElementById('btnReloadData');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', reloadData);
  }

  document.getElementById('filterFase').addEventListener('change', applyFilters);
  document.getElementById('filterCategoria').addEventListener('change', applyFilters);
  document.getElementById('filterMes').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 250));

  document.getElementById('btnResetFilters').addEventListener('click', resetFilters);
  document.getElementById('btnExportCsv').addEventListener('click', exportToCsv);

  // Pagination buttons
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });

  // Table header sorting
  document.querySelectorAll('#sessionsTable th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'desc';
      }
      sortData();
      renderTable();
    });
  });
}

function resetFilters() {
  document.getElementById('filterFase').value = 'ALL';
  document.getElementById('filterCategoria').value = 'ALL';
  document.getElementById('filterMes').value = 'ALL';
  document.getElementById('searchInput').value = '';
  applyFilters();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Core Filter Logic
function applyFilters() {
  const fase = document.getElementById('filterFase').value;
  const categoria = document.getElementById('filterCategoria').value;
  const mes = document.getElementById('filterMes').value;
  const search = document.getElementById('searchInput').value.toLowerCase().trim();

  filteredData = allData.filter(r => {
    const matchFase = (fase === 'ALL' || r.fase === fase);
    const matchCat = (categoria === 'ALL' || r.categoria === categoria);
    const matchMes = (mes === 'ALL' || r.mes_ano === mes);
    const matchSearch = (!search ||
      r.disciplina.toLowerCase().includes(search) ||
      r.data_formatada.includes(search) ||
      r.categoria.toLowerCase().includes(search) ||
      r.fase.toLowerCase().includes(search)
    );

    return matchFase && matchCat && matchMes && matchSearch;
  });

  currentPage = 1;
  sortData();
  updateKPIs();
  updateCharts();
  renderTable();
}

// Sorting logic
function sortData() {
  filteredData.sort((a, b) => {
    let valA = a[sortColumn];
    let valB = b[sortColumn];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'string') {
      const cmp = valA.localeCompare(valB, 'pt-BR');
      return sortDirection === 'asc' ? cmp : -cmp;
    } else {
      return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
    }
  });
}

// Update KPI Metric Cards
function updateKPIs() {
  const totalSegundos = filteredData.reduce((acc, r) => acc + r.segundos, 0);
  const totalHoras = (totalSegundos / 3600.0).toFixed(1);
  const totalMinutos = Math.round(totalSegundos / 60.0);
  const totalSessoes = filteredData.length;
  
  const diasUnicos = new Set(filteredData.map(r => r.data).filter(d => d !== 'Indefinida')).size;
  const mediaMinutosSessao = totalSessoes > 0 ? Math.round(totalMinutos / totalSessoes) : 0;
  const mediaHorasDia = diasUnicos > 0 ? (totalHoras / diasUnicos).toFixed(1) : 0;
  
  const disciplinasUnicas = new Set(filteredData.map(r => r.disciplina)).size;
  const pilaresUnicos = new Set(filteredData.map(r => r.categoria)).size;

  document.getElementById('kpiHoras').textContent = totalHoras;
  document.getElementById('kpiMinutosTotais').textContent = totalMinutos.toLocaleString('pt-BR') + ' min';
  document.getElementById('kpiSessoes').textContent = totalSessoes;
  document.getElementById('kpiDiasAtivos').textContent = diasUnicos;
  document.getElementById('kpiMediaSessao').textContent = mediaMinutosSessao;
  document.getElementById('kpiDisciplinas').textContent = disciplinasUnicas;
  document.getElementById('kpiPilares').textContent = pilaresUnicos;
  document.getElementById('kpiMediaDia').textContent = mediaHorasDia;

  // Period label
  if (filteredData.length > 0) {
    const sortedByDate = [...filteredData].sort((a, b) => a.data.localeCompare(b.data));
    const inicio = sortedByDate[0].data_formatada;
    const fim = sortedByDate[sortedByDate.length - 1].data_formatada;
    document.getElementById('periodoTexto').textContent = `${inicio} - ${fim}`;
  } else {
    document.getElementById('periodoTexto').textContent = 'Nenhum dado selecionado';
  }
}

// Initialize Charts
function initCharts() {
  if (chartTimeline) chartTimeline.dispose();
  if (chartPilares) chartPilares.dispose();
  if (chartDisciplinas) chartDisciplinas.dispose();
  if (chartHabitos) chartHabitos.dispose();

  const themeArg = currentTheme === 'dark' ? 'dark' : null;

  chartTimeline = echarts.init(document.getElementById('chartTimeline'), themeArg);
  chartPilares = echarts.init(document.getElementById('chartPilares'), themeArg);
  chartDisciplinas = echarts.init(document.getElementById('chartDisciplinas'), themeArg);
  chartHabitos = echarts.init(document.getElementById('chartHabitos'), themeArg);
}

function resizeCharts() {
  if (chartTimeline) chartTimeline.resize();
  if (chartPilares) chartPilares.resize();
  if (chartDisciplinas) chartDisciplinas.resize();
  if (chartHabitos) chartHabitos.resize();
}

// Update all ECharts
function updateCharts() {
  updateChartTimeline();
  updateChartPilares();
  updateChartDisciplinas();
  updateChartHabitos();
}

// Chart 1: Evolução Temporal & Acumulada
function updateChartTimeline() {
  const c = getThemeColors();
  const chronData = [...filteredData].sort((a, b) => {
    return a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio);
  });

  const dailyMap = {};
  chronData.forEach(r => {
    if (!dailyMap[r.data]) {
      dailyMap[r.data] = { data: r.data, label: r.data_formatada, horas: 0 };
    }
    dailyMap[r.data].horas += r.horas;
  });

  const days = Object.values(dailyMap);
  let acum = 0;
  const xLabels = [];
  const dailySeries = [];
  const acumSeries = [];

  days.forEach(d => {
    xLabels.push(d.label);
    const h = parseFloat(d.horas.toFixed(2));
    acum += h;
    dailySeries.push(h);
    acumSeries.push(parseFloat(acum.toFixed(2)));
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      textStyle: { color: c.tooltipText },
      formatter: function(params) {
        let res = `<div style="font-weight: bold; margin-bottom: 4px;">📅 ${params[0].name}</div>`;
        params.forEach(p => {
          res += `<div>${p.marker} ${p.seriesName}: <strong>${p.value}h</strong></div>`;
        });
        return res;
      }
    },
    legend: {
      data: ['Horas no Dia', 'Total Acumulado'],
      textStyle: { color: c.text },
      top: 0,
      right: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '16%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLine: { lineStyle: { color: c.axisLine } },
      axisLabel: { color: c.text, rotate: xLabels.length > 15 ? 40 : 0 }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Horas / Dia',
        nameTextStyle: { color: c.text },
        axisLabel: { color: c.text, formatter: '{value}h' },
        splitLine: { lineStyle: { color: c.splitLine } }
      },
      {
        type: 'value',
        name: 'Acumulado',
        nameTextStyle: { color: c.text },
        axisLabel: { color: c.text, formatter: '{value}h' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Horas no Dia',
        type: 'bar',
        data: dailySeries,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#38bdf8' },
            { offset: 1, color: '#0284c7' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: 'Total Acumulado',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: acumSeries,
        lineStyle: {
          width: 3.5,
          color: '#6366f1'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: currentTheme === 'light' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.45)' },
            { offset: 1, color: 'rgba(99, 102, 241, 0.01)' }
          ])
        }
      }
    ]
  };

  chartTimeline.setOption(option, true);
}

// Chart 2: Donut de Pilares de Conhecimento
function updateChartPilares() {
  const c = getThemeColors();
  const catMap = {};
  filteredData.forEach(r => {
    catMap[r.categoria] = (catMap[r.categoria] || 0) + r.horas;
  });

  const colors = {
    'SQL & Dados': '#6366f1',
    'Estatística & Probabilidade': '#06b6d4',
    'Visualização de Dados': '#f43f5e',
    'Programação (R / Python)': '#a855f7',
    'ML & Fundamentos': '#f59e0b',
    'Outros': '#64748b'
  };

  const seriesData = Object.keys(catMap).map(k => ({
    name: k,
    value: parseFloat(catMap[k].toFixed(1)),
    itemStyle: { color: colors[k] || '#94a3b8' }
  })).sort((a, b) => b.value - a.value);

  const total = seriesData.reduce((acc, item) => acc + item.value, 0).toFixed(1);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      textStyle: { color: c.tooltipText },
      formatter: '{b}: <strong>{c}h</strong> ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '0%',
      textStyle: { color: c.text, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10
    },
    title: {
      text: `${total}h`,
      subtext: 'Total de Horas',
      left: 'center',
      top: '38%',
      textStyle: {
        color: c.heading,
        fontSize: 22,
        fontWeight: 'bold'
      },
      subtextStyle: {
        color: c.text,
        fontSize: 12
      }
    },
    series: [
      {
        name: 'Horas por Pilar',
        type: 'pie',
        radius: ['52%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: c.pieBorder,
          borderWidth: 3
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
            color: c.heading
          }
        },
        data: seriesData
      }
    ]
  };

  chartPilares.setOption(option, true);
}

// Chart 3: Top Disciplinas (Horizontal Bar)
function updateChartDisciplinas() {
  const c = getThemeColors();
  const discMap = {};
  filteredData.forEach(r => {
    discMap[r.disciplina] = (discMap[r.disciplina] || 0) + r.horas;
  });

  let sorted = Object.keys(discMap).map(k => ({
    name: k,
    value: parseFloat(discMap[k].toFixed(1))
  })).sort((a, b) => b.value - a.value);

  sorted = sorted.slice(0, 10).reverse();

  const yLabels = sorted.map(item => item.name);
  const values = sorted.map(item => item.value);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      textStyle: { color: c.tooltipText },
      formatter: '{b}: <strong>{c} horas</strong>'
    },
    grid: {
      left: '4%',
      right: '8%',
      bottom: '5%',
      top: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: c.axisLine } },
      axisLabel: { color: c.text, formatter: '{value}h' },
      splitLine: { lineStyle: { color: c.splitLine } }
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      axisLine: { lineStyle: { color: c.axisLine } },
      axisLabel: {
        color: c.text,
        fontSize: 11,
        formatter: function(val) {
          return val.length > 25 ? val.substring(0, 23) + '...' : val;
        }
      }
    },
    series: [
      {
        name: 'Horas',
        type: 'bar',
        data: values,
        label: {
          show: true,
          position: 'right',
          color: c.text,
          formatter: '{c}h',
          fontSize: 11
        },
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#4f46e5' },
            { offset: 1, color: '#06b6d4' }
          ]),
          borderRadius: [0, 6, 6, 0]
        }
      }
    ]
  };

  chartDisciplinas.setOption(option, true);
}

// Chart 4: Hábitos de Estudo (Dia da Semana x Turno)
function updateChartHabitos() {
  const c = getThemeColors();
  const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const turnos = ['Manhã', 'Tarde', 'Noite'];

  const matrix = {
    'Manhã': [0, 0, 0, 0, 0, 0, 0],
    'Tarde': [0, 0, 0, 0, 0, 0, 0],
    'Noite': [0, 0, 0, 0, 0, 0, 0]
  };

  filteredData.forEach(r => {
    const dIdx = r.dia_semana_num;
    const turno = r.turno;
    if (dIdx >= 0 && dIdx < 7 && matrix[turno]) {
      matrix[turno][dIdx] += r.horas;
    }
  });

  const colors = {
    'Manhã': '#f59e0b',
    'Tarde': '#06b6d4',
    'Noite': '#6366f1'
  };

  const series = turnos.map(t => ({
    name: t,
    type: 'bar',
    stack: 'total',
    emphasis: { focus: 'series' },
    itemStyle: {
      color: colors[t],
      borderRadius: [0, 0, 0, 0]
    },
    data: matrix[t].map(v => parseFloat(v.toFixed(1)))
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: c.tooltipBg,
      borderColor: c.tooltipBorder,
      textStyle: { color: c.tooltipText },
      formatter: function(params) {
        let total = 0;
        let str = `<div style="font-weight: bold; margin-bottom: 4px;">${params[0].name}</div>`;
        params.forEach(p => {
          str += `<div>${p.marker} ${p.seriesName}: ${p.value}h</div>`;
          total += Number(p.value);
        });
        str += `<div style="margin-top: 4px; border-top: 1px solid ${c.splitLine}; padding-top: 4px;"><strong>Total: ${total.toFixed(1)}h</strong></div>`;
        return str;
      }
    },
    legend: {
      data: turnos,
      textStyle: { color: c.text },
      top: 0,
      right: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '16%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: diasSemana,
      axisLine: { lineStyle: { color: c.axisLine } },
      axisLabel: { color: c.text }
    },
    yAxis: {
      type: 'value',
      name: 'Horas Totais',
      nameTextStyle: { color: c.text },
      axisLine: { lineStyle: { color: c.axisLine } },
      axisLabel: { color: c.text, formatter: '{value}h' },
      splitLine: { lineStyle: { color: c.splitLine } }
    },
    series: series
  };

  chartHabitos.setOption(option, true);
}

// Render Paginated Table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  const total = filteredData.length;
  document.getElementById('tableInfoBadge').textContent = `Mostrando ${total} sessões`;

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          Nenhuma sessão encontrada para os filtros selecionados.
        </td>
      </tr>
    `;
    document.getElementById('pageInfo').textContent = 'Página 0 de 0';
    document.getElementById('btnPrevPage').disabled = true;
    document.getElementById('btnNextPage').disabled = true;
    return;
  }

  const totalPages = Math.ceil(total / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageItems = filteredData.slice(startIdx, endIdx);

  pageItems.forEach(r => {
    const tr = document.createElement('tr');
    
    // Category Badge Class
    let catClass = 'badge-cat-sql';
    if (r.categoria.includes('Estatística')) catClass = 'badge-cat-stats';
    else if (r.categoria.includes('Programação')) catClass = 'badge-cat-prog';
    else if (r.categoria.includes('Visualização')) catClass = 'badge-cat-vis';
    else if (r.categoria.includes('ML')) catClass = 'badge-cat-ml';

    // Fase Badge
    const faseClass = r.fase === 'Novo' ? 'badge-fase-novo' : 'badge-fase-antigo';

    tr.innerHTML = `
      <td style="font-weight: 600;">${r.data_formatada}</td>
      <td style="color: var(--text-secondary);">${r.dia_semana}</td>
      <td style="font-weight: 600;">${r.disciplina}</td>
      <td><span class="badge ${catClass}">${r.categoria}</span></td>
      <td><span class="badge ${faseClass}">${r.fase}</span></td>
      <td><span class="badge badge-turno">${r.turno}</span></td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">
        ${r.hora_inicio ? r.hora_inicio.substring(0, 5) : '--'} - ${r.hora_fim ? r.hora_fim.substring(0, 5) : '--'}
      </td>
      <td style="font-weight: 700; color: var(--accent-cyan);">${r.duracao_formatada}</td>
    `;
    tbody.appendChild(tr);
  });

  // Update pagination info
  document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages} (${startIdx + 1}-${endIdx} de ${total})`;
  document.getElementById('btnPrevPage').disabled = (currentPage === 1);
  document.getElementById('btnNextPage').disabled = (currentPage === totalPages);
}

// Export filtered data to CSV
function exportToCsv() {
  if (filteredData.length === 0) {
    alert('Nenhum dado para exportar.');
    return;
  }

  const headers = ['Data', 'Dia_Semana', 'Disciplina', 'Categoria', 'Fase', 'Turno', 'Hora_Inicio', 'Hora_Fim', 'Duracao', 'Horas_Decimais'];
  const csvRows = [headers.join(';')];

  filteredData.forEach(r => {
    const row = [
      r.data_formatada,
      r.dia_semana,
      `"${r.disciplina.replace(/"/g, '""')}"`,
      `"${r.categoria}"`,
      r.fase,
      r.turno,
      r.hora_inicio,
      r.hora_fim,
      r.duracao_formatada,
      r.horas.toString().replace('.', ',')
    ];
    csvRows.push(row.join(';'));
  });

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `controle_estudos_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
