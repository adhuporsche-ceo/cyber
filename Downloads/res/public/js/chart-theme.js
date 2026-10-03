const ChartTheme = (() => {
  const tokens = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
      fg: styles.getPropertyValue('--fg').trim(),
      bg: styles.getPropertyValue('--bg').trim(),
      inverseBg: styles.getPropertyValue('--inverse-bg').trim(),
      inverseFg: styles.getPropertyValue('--inverse-fg').trim(),
      primary: styles.getPropertyValue('--blue-500').trim(),
      deep: styles.getPropertyValue('--blue-700').trim(),
      ink: styles.getPropertyValue('--blue-900').trim(),
      accent: styles.getPropertyValue('--cyan-500').trim(),
      pale: styles.getPropertyValue('--blue-100').trim(),
    };
  };

  const colors = () => {
    const { primary, deep, ink, accent } = tokens();
    return [primary, deep, accent, ink];
  };

  function patternFactory(type = 'solid') {
    const { fg, bg } = tokens();
    const canvas = document.createElement('canvas');
    canvas.width = 12;
    canvas.height = 12;
    const context = canvas.getContext('2d');
    context.fillStyle = bg;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = fg;
    context.fillStyle = fg;
    context.lineWidth = 2;
    if (type === 'solid') context.fillRect(0, 0, canvas.width, canvas.height);
    if (type === 'diagonal') { context.beginPath(); context.moveTo(-2, 10); context.lineTo(10, -2); context.stroke(); context.moveTo(2, 14); context.lineTo(14, 2); context.stroke(); }
    if (type === 'reverse-diagonal') { context.beginPath(); context.moveTo(-2, 2); context.lineTo(10, 14); context.stroke(); context.moveTo(2, -2); context.lineTo(14, 10); context.stroke(); }
    if (type === 'dots') { context.beginPath(); context.arc(3, 3, 2, 0, Math.PI * 2); context.fill(); context.beginPath(); context.arc(9, 9, 2, 0, Math.PI * 2); context.fill(); }
    if (type === 'cross') { context.beginPath(); context.moveTo(0, 0); context.lineTo(12, 12); context.moveTo(12, 0); context.lineTo(0, 12); context.stroke(); }
    if (type === 'horizontal') { context.fillRect(0, 4, 12, 2); context.fillRect(0, 10, 12, 2); }
    if (type === 'vertical') { context.fillRect(4, 0, 2, 12); context.fillRect(10, 0, 2, 12); }
    return context.createPattern(canvas, 'repeat');
  }

  function apply() {
    if (!window.Chart) return;
    const { fg, inverseBg, inverseFg, pale } = tokens();
    Chart.defaults.color = fg;
    Chart.defaults.font.family = 'Inter';
    Chart.defaults.borderColor = fg;
    Chart.defaults.plugins.legend.labels.color = fg;
    Chart.defaults.plugins.tooltip.backgroundColor = inverseBg;
    Chart.defaults.plugins.tooltip.titleColor = inverseFg;
    Chart.defaults.plugins.tooltip.bodyColor = inverseFg;
    Chart.defaults.plugins.tooltip.borderColor = fg;
    Chart.defaults.plugins.tooltip.borderWidth = 2;
    Chart.defaults.scale.grid.color = pale;
    Chart.defaults.scale.grid.borderDash = [4, 4];
    Chart.defaults.scale.ticks.color = fg;
  }

  return { tokens, colors, patternFactory, apply };
})();

window.ChartTheme = ChartTheme;
window.addEventListener('sps:themechange', () => ChartTheme.apply());
