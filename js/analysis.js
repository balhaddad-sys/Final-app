/**
 * MedWard Enterprise - AI Analysis Module
 */

var MedWard = MedWard || {};

MedWard.Analysis = {
  images: [],
  type: 'lab',
  
  setType(type, el) {
    const { $$ } = MedWard.Utils;
    this.type = type;
    $$('.analysis-type').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  },
  
  addImage(file) {
    const { toast } = MedWard.Utils;
    
    if (this.images.length >= MedWard.CONFIG.MAX_IMAGES) {
      toast(`Maximum ${MedWard.CONFIG.MAX_IMAGES} images allowed`, true);
      return;
    }
    
    MedWard.Utils.compressImage(file, MedWard.CONFIG.MAX_IMAGE_SIZE, (dataUrl) => {
      this.images.push({
        id: Date.now(),
        name: file.name,
        data: dataUrl
      });
      this.renderImages();
      MedWard.Utils.$('analyzeBtn').disabled = false;
      toast(`Image added (${this.images.length}/${MedWard.CONFIG.MAX_IMAGES})`);
    });
  },
  
  removeImage(id) {
    this.images = this.images.filter(img => img.id !== id);
    this.renderImages();
    if (this.images.length === 0) {
      MedWard.Utils.$('analyzeBtn').disabled = true;
    }
  },
  
  renderImages() {
    const { $ } = MedWard.Utils;
    const preview = $('analysisPreview');
    
    if (this.images.length === 0) {
      preview.style.display = 'none';
      return;
    }
    
    let html = '<div class="image-gallery">';
    this.images.forEach(img => {
      html += `
        <div class="image-thumb">
          <img src="${img.data}" alt="Preview">
          <button class="image-thumb-remove" onclick="MedWard.Analysis.removeImage(${img.id})">✕</button>
        </div>`;
    });
    html += '</div>';
    html += `<div style="font-size:0.75rem;color:var(--text-muted)">${this.images.length}/${MedWard.CONFIG.MAX_IMAGES} images • Click upload to add more</div>`;
    
    preview.innerHTML = html;
    preview.style.display = 'block';
  },
  
  clear() {
    const { $ } = MedWard.Utils;
    this.images = [];
    $('analysisPreview').style.display = 'none';
    $('analyzeBtn').disabled = true;
    $('analysisFile').value = '';
    $('analysisResults').innerHTML = '';
  },
  
  async run() {
    const { $, escapeHtml, toast } = MedWard.Utils;
    
    if (this.images.length === 0) return;
    
    $('analyzeBtn').disabled = true;
    $('analysisLoading').style.display = 'block';
    $('analysisResults').innerHTML = '';
    
    const typeNames = {
      lab: 'Laboratory Results',
      xray: 'X-Ray',
      ct: 'CT/MRI Scan',
      ecg: 'ECG'
    };
    
    try {
      const response = await fetch(MedWard.Storage.state.settings.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'interpret',
          documentType: this.type,
          images: this.images.map(img => ({ data: img.data })),
          image: this.images[0].data,
          multiImage: this.images.length > 1
        })
      });
      
      const data = await response.json();
      
      $('analysisLoading').style.display = 'none';
      $('analyzeBtn').disabled = false;
      
      if (data.error) {
        $('analysisResults').innerHTML = `<div class="result-card"><h4>⚠️ Error</h4><p>${escapeHtml(data.error)}</p></div>`;
        return;
      }
      
      let html = `<div class="result-card"><h4>📋 ${typeNames[this.type]} Analysis</h4>`;
      
      if (this.images.length > 1) {
        html += `<p style="color:var(--teal);font-size:0.8rem;margin-bottom:10px">✓ Combined analysis of ${this.images.length} images</p>`;
      }
      
      if (data.interpretation) {
        const interp = data.interpretation;
        if (interp.summary) html += `<p><b>Summary:</b> ${escapeHtml(interp.summary)}</p>`;
        
        if (interp.keyFindings?.length) {
          html += '<p><b>Key Findings:</b></p><ul>';
          interp.keyFindings.forEach(f => html += `<li>${escapeHtml(f)}</li>`);
          html += '</ul>';
        }
        
        if (interp.abnormalities?.length) {
          html += '<p><b class="abnormal">Abnormalities:</b></p><ul>';
          interp.abnormalities.forEach(a => html += `<li class="abnormal">${escapeHtml(a)}</li>`);
          html += '</ul>';
        }
        
        if (interp.normalFindings?.length) {
          html += '<p><b class="normal">Normal Findings:</b></p><ul>';
          interp.normalFindings.forEach(n => html += `<li>${escapeHtml(n)}</li>`);
          html += '</ul>';
        }
      }
      html += '</div>';
      
      if (data.clinicalPearls?.length) {
        html += '<div class="result-card"><h4>💡 Clinical Pearls</h4><ul>';
        data.clinicalPearls.forEach(p => html += `<li>${escapeHtml(p)}</li>`);
        html += '</ul></div>';
      }
      
      if (data.presentation) {
        html += '<div class="result-card"><h4>📝 Presentation</h4>';
        if (data.presentation.patientFriendly) {
          html += `<p><b>Patient-Friendly:</b> ${escapeHtml(data.presentation.patientFriendly)}</p>`;
        }
        if (data.presentation.recommendations?.length) {
          html += '<p><b>Recommendations:</b></p><ul>';
          data.presentation.recommendations.forEach(r => html += `<li>${escapeHtml(r)}</li>`);
          html += '</ul>';
        }
        html += '</div>';
      }
      
      $('analysisResults').innerHTML = html;
      toast('Analysis complete!');
      
    } catch (error) {
      $('analysisLoading').style.display = 'none';
      $('analyzeBtn').disabled = false;
      $('analysisResults').innerHTML = '<div class="result-card"><h4>⚠️ Error</h4><p>Connection failed. Check your API URL in Admin settings.</p></div>';
    }
  }
};
