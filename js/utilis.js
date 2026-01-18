/**
 * MedWard Enterprise - Utilities
 */

var MedWard = MedWard || {};

MedWard.Utils = {
  $(id) { return document.getElementById(id); },
  $$(sel) { return document.querySelectorAll(sel); },
  
  toast(msg, isError) {
    const t = this.$('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => { t.className = 'toast'; }, 3000);
  },
  
  initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  },
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  openModal(id) { this.$(id).classList.add('active'); },
  closeModal(id) { this.$(id).classList.remove('active'); },
  
  compressImage(file, maxSize, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width;
        let height = img.height;
        let quality = MedWard.CONFIG.IMAGE_QUALITY;
        const maxDim = MedWard.CONFIG.MAX_IMAGE_DIMENSION;
        
        // Scale down if too large
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * maxDim / width);
            width = maxDim;
          } else {
            width = Math.round(width * maxDim / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Reduce quality if still too large
        while (dataUrl.length > maxSize && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        
        // Reduce dimensions if still too large
        while (dataUrl.length > maxSize && width > 800) {
          width = Math.round(width * 0.8);
          height = Math.round(height * 0.8);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};
