document.addEventListener('DOMContentLoaded', () => {
    const hintEl = document.createElement('div');
    hintEl.id = 'global-hint';
    document.body.appendChild(hintEl);

    const icons = document.querySelectorAll('.help-icon');

    icons.forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
            const text = icon.getAttribute('data-hint');
            hintEl.textContent = text;
            hintEl.style.display = 'block';

            const rect = icon.getBoundingClientRect();
            
            hintEl.style.left = `${rect.left + rect.width / 2}px`;
            hintEl.style.top = `${rect.top - 10}px`;
            hintEl.style.transform = 'translate(-50%, -100%)';
            
            setTimeout(() => hintEl.style.opacity = '1', 10);
        });

        icon.addEventListener('mouseleave', () => {
            hintEl.style.opacity = '0';
            setTimeout(() => {
                if (hintEl.style.opacity === '0') hintEl.style.display = 'none';
            }, 200);
        });
    });
});