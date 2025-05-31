document.addEventListener('DOMContentLoaded', function() {
  const webpagesList = document.getElementById('webpagesList'); // New list for type 'page'
  const websitesList = document.getElementById('websitesList'); // For type 'website'
  const youtubeVideosList = document.getElementById('youtubeVideosList');
  const youtubeChannelsList = document.getElementById('youtubeChannelsList');
  const selectionsList = document.getElementById('selectionsList');

  // Sidebar navigation elements
  const sidebarLinks = document.querySelectorAll('.sidebar a');
  const contentSections = document.querySelectorAll('.main-content .content-section');
  const mainContentTitle = document.querySelector('.main-content > h1');
  const sidebar = document.querySelector('.sidebar'); // Added
  const optionsContainer = document.querySelector('.options-container'); // Added

  const dragDropToggle = document.getElementById('dragDropToggle');
  let dragDropEnabled = false;
  let draggedItem = null;
  let originalBookmarksOrder = []; // Added

  // Function to update draggable attributes and visual cues (Added)
  function updateDraggableState(enabled) {
    const lists = [webpagesList, websitesList, youtubeVideosList, youtubeChannelsList, selectionsList]; // Added webpagesList
    lists.forEach(list => {
      if (!list) return; // Add a guard in case a list element isn't found
      if (enabled) {
        list.classList.add('dnd-enabled');
      } else {
        list.classList.remove('dnd-enabled');
      }
      Array.from(list.children).forEach(item => {
        if (item.classList.contains('bookmark-item')) { // Ensure it's a bookmark item
          item.setAttribute('draggable', enabled ? 'true' : 'false');
        }
      });
    });
  }

  // --- DRAG AND DROP HANDLERS --- (Added)
  function handleDragStart(e) {
    if (!dragDropEnabled || !e.target.classList.contains('bookmark-item')) return;
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id); // Store ID
    // Timeout to allow browser to render drag image before style change
    setTimeout(() => {
      if (draggedItem) draggedItem.classList.add('dragging');
    }, 0);
    
    // Store current order of all bookmarks
    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      originalBookmarksOrder = data.bookmarks.map(bm => bm.id);
    });
  }

  function handleDragOver(e) {
    if (!dragDropEnabled || !draggedItem) return;
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';

    const targetItem = e.target.closest('.bookmark-item');
    if (targetItem && targetItem !== draggedItem && targetItem.parentElement === draggedItem.parentElement) {
      Array.from(draggedItem.parentElement.children).forEach(child => {
        if (child.classList.contains('bookmark-item')) child.classList.remove('drag-over');
      });
      targetItem.classList.add('drag-over');
    }
  }

  function handleDragLeave(e) {
      const targetItem = e.target.closest('.bookmark-item');
      if (targetItem) {
          targetItem.classList.remove('drag-over');
      }
  }

  function handleDrop(e) {
    if (!dragDropEnabled || !draggedItem) return;
    e.preventDefault();
    const targetItem = e.target.closest('.bookmark-item');
    const droppedOnList = e.target.closest('.bookmark-list');

    if (draggedItem.parentElement) { // Check if draggedItem still has a parent
        Array.from(draggedItem.parentElement.children).forEach(child => {
            if (child.classList.contains('bookmark-item')) child.classList.remove('drag-over');
        });
    }


    if (!targetItem && !droppedOnList) { // Dropped outside a valid target or list
      return;
    }
    
    const draggedItemId = e.dataTransfer.getData('text/plain');
    
    // Ensure drop is within the same list type
    if (targetItem && targetItem.parentElement !== draggedItem.parentElement) {
      console.warn("Cannot move bookmarks between different lists.");
      return; 
    }
    
    if (!targetItem && droppedOnList && droppedOnList === draggedItem.parentElement) {
       const list = draggedItem.parentElement;
       list.appendChild(draggedItem); 
       updateStoredOrder(list);
       return;
    }
    
    if (targetItem && targetItem !== draggedItem) {
      const list = targetItem.parentElement;
      const children = Array.from(list.children).filter(child => child.classList.contains('bookmark-item'));
      const draggedIndex = children.indexOf(draggedItem);
      const targetIndex = children.indexOf(targetItem);

      if (draggedIndex < targetIndex) {
        list.insertBefore(draggedItem, targetItem.nextSibling);
      } else {
        list.insertBefore(draggedItem, targetItem);
      }
      updateStoredOrder(list);
    }
  }

  function handleDragEnd(e) {
    if (!draggedItem) return;
    draggedItem.classList.remove('dragging');
    if (draggedItem.parentElement) { // Check if draggedItem still has a parent
        Array.from(draggedItem.parentElement.children).forEach(child => {
            if (child.classList.contains('bookmark-item')) child.classList.remove('drag-over');
        });
    }
    draggedItem = null;
    originalBookmarksOrder = []; 
  }

  // Function to update chrome.storage.local with new order from a list (Added)
  function updateStoredOrder(listElement) {
    const newOrderedIdsInList = Array.from(listElement.children)
                                .map(item => item.dataset.id)
                                .filter(id => id); 

    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      let allBookmarks = data.bookmarks;
      const bookmarkMap = new Map(allBookmarks.map(bm => [bm.id, bm]));
      let updatedBookmarks = [];
      let usedIds = new Set();

      // Add reordered items from the current list first
      newOrderedIdsInList.forEach(id => {
          if (bookmarkMap.has(id)) {
              updatedBookmarks.push(bookmarkMap.get(id));
              usedIds.add(id);
          }
      });
      
      // Add items from other lists or not in this list, maintaining original overall order as much as possible
      originalBookmarksOrder.forEach(id => {
          if (!usedIds.has(id) && bookmarkMap.has(id)) {
              updatedBookmarks.push(bookmarkMap.get(id));
              usedIds.add(id);
          }
      });

      // Add any truly new bookmarks not captured (should be rare here)
      allBookmarks.forEach(bm => {
          if(!usedIds.has(bm.id)) {
              updatedBookmarks.push(bm);
          }
      });

      chrome.storage.local.set({ bookmarks: updatedBookmarks }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error updating bookmark order:", chrome.runtime.lastError);
        } else {
          console.log("Bookmark order updated successfully.");
        }
      });
    });
  }

  // Function to create a bookmark list item element
  function createBookmarkElement(bookmark) {
    const item = document.createElement('li');
    item.classList.add('bookmark-item');
    item.setAttribute('data-id', bookmark.id);

    let imageAreaContent = '';
    let displayImageUrl = bookmark.thumbnailUrl || bookmark.faviconUrl;
    let imageSpecificClass = bookmark.thumbnailUrl ? 'bookmark-thumbnail' : (bookmark.faviconUrl ? 'bookmark-favicon' : '');

    if (displayImageUrl) {
      try {
        new URL(displayImageUrl); // Validate URL (basic check)
        imageAreaContent = `
          <div class="bookmark-image-container">
            <img src="${escapeHTML(displayImageUrl)}" alt="${escapeHTML(bookmark.title)}" class="bookmark-image ${imageSpecificClass}">
          </div>`;
      } catch (e) {
        console.warn("Invalid image URL for bookmark:", bookmark.title, displayImageUrl, e);
        imageAreaContent = '<div class="bookmark-image-placeholder"></div>'; // Placeholder for invalid URL
      }
    } else {
      imageAreaContent = '<div class="bookmark-image-placeholder"></div>'; // Placeholder for no image
    }

    let textContent = `
      <div class="bookmark-info">
        <span class="bookmark-title">${escapeHTML(bookmark.title)}</span>
        <a href="${escapeHTML(bookmark.url)}" target="_blank" class="bookmark-url" title="${escapeHTML(bookmark.url)}">${escapeHTML(bookmark.url.length > 60 ? bookmark.url.substring(0,57) + '...' : bookmark.url)}</a>`;

    if (bookmark.type === 'selection' && bookmark.text) {
        textContent += `<p class="bookmark-selection-text"><em>"${escapeHTML(bookmark.text)}"</em></p>`;
    }
    
    textContent += `
        <small class="bookmark-date">Added: ${new Date(bookmark.added_date).toLocaleString()}</small>
      </div>
    `;

    item.innerHTML = `
      ${imageAreaContent}
      ${textContent}
      <div class="bookmark-actions">
        <button class="deleteBtn" data-id="${bookmark.id}" title="Delete bookmark">Delete</button>
      </div>
    `;
    return item;
  }

  // Function to render bookmarks to their respective lists
  function renderBookmarks(bookmarks) {
    // Clear existing placeholder or old bookmarks
    webpagesList.innerHTML = ''; // Added
    websitesList.innerHTML = '';
    youtubeVideosList.innerHTML = '';
    youtubeChannelsList.innerHTML = '';
    selectionsList.innerHTML = '';

    if (bookmarks.length === 0) {
        webpagesList.innerHTML = '<li class="empty-list-placeholder">No webpages bookmarked yet.</li>'; // Added
        websitesList.innerHTML = '<li class="empty-list-placeholder">No website domain bookmarks yet.</li>'; // Clarified
        youtubeVideosList.innerHTML = '<li class="empty-list-placeholder">No YouTube video bookmarks yet.</li>';
        youtubeChannelsList.innerHTML = '<li class="empty-list-placeholder">No YouTube channel bookmarks yet.</li>';
        selectionsList.innerHTML = '<li class="empty-list-placeholder">No selections bookmarked yet.</li>';
    }

    bookmarks.forEach(bookmark => {
      const bookmarkElement = createBookmarkElement(bookmark);
      if (bookmark.type === 'page') { // New condition for 'page'
        webpagesList.appendChild(bookmarkElement);
      } else if (bookmark.type === 'website') { // Specific condition for 'website'
        websitesList.appendChild(bookmarkElement);
      } else if (bookmark.type === 'youtube_video') {
        youtubeVideosList.appendChild(bookmarkElement);
      } else if (bookmark.type === 'youtube_channel') {
        youtubeChannelsList.appendChild(bookmarkElement);
      } else if (bookmark.type === 'selection') {
        selectionsList.appendChild(bookmarkElement);
      } else {
        // Fallback for any other types or if type is undefined
        // For now, let's put them in 'Webpages' or log an error
        console.warn('Unknown bookmark type or type not handled:', bookmark.type, bookmark);
        // webpagesList.appendChild(bookmarkElement); // Optional: default to webpages
      }
    });
    
    updateDraggableState(dragDropEnabled); 
    addListEventListeners(); 
  }

  // Load bookmarks from storage and render them
  function loadAndRenderBookmarks() {
    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      // D&D relies on the order from storage. If we sort here for display only,
      // the D&D logic might get confused. For D&D, it's best to render
      // in the order they are stored, or ensure D&D updates the sorted source.
      // For now, removing the sort for D&D to work correctly with array indices.
      // Sorting will be handled by how items are added/moved.
      // renderBookmarks(data.bookmarks.sort((a,b) => new Date(b.added_date) - new Date(a.added_date)));
      renderBookmarks(data.bookmarks); 
    });
  }
  
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.toString().replace(/[&<>"']/g, function (match) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
    });
  }

  let activeConfirmationContext = null; // { originalDeleteBtn, yesBtn, noBtn, actionsDiv }

  function resetActiveConfirmation() {
    if (activeConfirmationContext) {
      activeConfirmationContext.originalDeleteBtn.style.display = '';
      if (activeConfirmationContext.yesBtn.parentNode) {
        activeConfirmationContext.yesBtn.remove();
      }
      if (activeConfirmationContext.noBtn.parentNode) {
        activeConfirmationContext.noBtn.remove();
      }
      activeConfirmationContext = null;
    }
  }

  function handleDeleteBookmark(event) {
    if (event.target.classList.contains('deleteBtn')) {
      const originalDeleteBtn = event.target;
      const bookmarkId = originalDeleteBtn.getAttribute('data-id');
      const actionsDiv = originalDeleteBtn.closest('.bookmark-actions');

      // If this button's confirmation is already active, do nothing (or could toggle it off)
      if (activeConfirmationContext && activeConfirmationContext.originalDeleteBtn === originalDeleteBtn) {
        // Optional: could make clicking active delete button again act as "No"
        // resetActiveConfirmation();
        return;
      }

      // Reset any other active confirmation
      resetActiveConfirmation();

      originalDeleteBtn.style.display = 'none';

      const yesBtn = document.createElement('button');
      yesBtn.textContent = 'Yes';
      yesBtn.classList.add('confirm-delete-yes');

      const noBtn = document.createElement('button');
      noBtn.textContent = 'No';
      noBtn.classList.add('confirm-delete-no');

      actionsDiv.appendChild(yesBtn);
      actionsDiv.appendChild(noBtn);

      activeConfirmationContext = { originalDeleteBtn, yesBtn, noBtn, actionsDiv };

      yesBtn.addEventListener('click', function() {
        chrome.storage.local.get({ bookmarks: [] }, function(data) {
          let bookmarks = data.bookmarks.filter(bm => bm.id !== bookmarkId);
          chrome.storage.local.set({ bookmarks: bookmarks }, function() {
            if (chrome.runtime.lastError) {
              console.error("Error deleting bookmark:", chrome.runtime.lastError);
            } else {
              console.log("Bookmark deleted:", bookmarkId);
              // UI update will be handled by storage.onChanged -> loadAndRenderBookmarks
            }
            // Clean up confirmation state regardless of success/failure of storage operation,
            // as the action is now "done" from user perspective.
            resetActiveConfirmation();
          });
        });
      });

      noBtn.addEventListener('click', function() {
        resetActiveConfirmation();
      });
    }
  }
  
  // Renamed and expanded function (Modified)
  function addListEventListeners() {
    const lists = [webpagesList, websitesList, youtubeVideosList, youtubeChannelsList, selectionsList]; // Added webpagesList
    lists.forEach(list => {
      if (!list) return; // Add a guard
      // Delete listener (event delegation)
      // Remove first to prevent duplicates if this function is ever called multiple times on the same list
      list.removeEventListener('click', handleDeleteBookmark); 
      list.addEventListener('click', handleDeleteBookmark);

      // D&D Listeners
      // Remove first to prevent duplicates
      list.removeEventListener('dragstart', handleDragStart);
      list.removeEventListener('dragover', handleDragOver);
      list.removeEventListener('dragleave', handleDragLeave);
      list.removeEventListener('drop', handleDrop);
      list.removeEventListener('dragend', handleDragEnd);
      
      list.addEventListener('dragstart', handleDragStart);
      list.addEventListener('dragover', handleDragOver);
      list.addEventListener('dragleave', handleDragLeave);
      list.addEventListener('drop', handleDrop);
      list.addEventListener('dragend', handleDragEnd);
    });
  }

  // Drag and Drop Toggle Functionality (Added)
  dragDropToggle.addEventListener('change', function() {
    dragDropEnabled = this.checked;
    updateDraggableState(dragDropEnabled);
    chrome.storage.local.set({ dragDropEnabledSetting: dragDropEnabled });
  });

  // Load D&D enabled state from storage (Added)
  chrome.storage.local.get({ dragDropEnabledSetting: false }, function(data) {
    dragDropEnabled = data.dragDropEnabledSetting;
    dragDropToggle.checked = dragDropEnabled;
    updateDraggableState(dragDropEnabled); 
  });

  // --- Collapsible Sidebar JS ---
  if (sidebar && optionsContainer) {
    sidebar.addEventListener('mouseenter', function() {
      optionsContainer.classList.add('sidebar-expanded');
    });
    sidebar.addEventListener('mouseleave', function() {
      optionsContainer.classList.remove('sidebar-expanded');
    });
  }

  // --- SIDEBAR NAVIGATION ---
  function setActiveContent(targetId) {
    // Update main title based on section, or set a generic one for settings
    if (targetId === 'settings') {
        mainContentTitle.textContent = 'Application Settings';
    } else {
        // Find the link text and use it for the title
        const activeLink = document.querySelector(`.sidebar a[data-target="${targetId}"]`);
        mainContentTitle.textContent = activeLink ? activeLink.textContent : 'My Bookmarks';
    }

    contentSections.forEach(section => {
      if (section.id === 'content-' + targetId) {
        section.classList.add('active-content');
      } else {
        section.classList.remove('active-content');
      }
    });

    sidebarLinks.forEach(link => {
      if (link.dataset.target === targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
    // Persist the last active tab to local storage
    chrome.storage.local.set({ lastActiveOptionsTab: targetId });
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      const target = this.dataset.target;
      setActiveContent(target);
    });
  });

  // Initial load & State Restoration
  loadAndRenderBookmarks(); // Load bookmarks first

  // Restore last active tab or default to 'videos'
  chrome.storage.local.get({ lastActiveOptionsTab: 'videos' }, function(data) {
    // If the stored last active tab was 'websites', and it's now split,
    // defaulting to 'webpages' is a reasonable behavior.
    // Or, explicitly check if data.lastActiveOptionsTab is 'websites' and change to 'webpages'
    let initialTab = data.lastActiveOptionsTab;
    // The logic below was to handle the transition from a single 'websites' tab to 'webpages'/'websites' split.
    // It might not be strictly necessary anymore if the default is 'videos' and HTML has no static active class.
    // However, keeping it won't harm, as it tries to find an active class in HTML if the stored one is problematic.
    // If no active class is in HTML (which will be the case after next step), it will use the default from storage.get ('videos').
    const activeSidebarLink = document.querySelector('.sidebar a.active');
    if (activeSidebarLink && initialTab !== activeSidebarLink.dataset.target) {
        // This case is unlikely if HTML defaults are removed.
        // If HTML had a static active class different from 'videos' (the new default),
        // this would ensure JS overrides it with the 'videos' default.
        // However, the goal is to remove HTML static active classes.
    }

    // If no active class is set by HTML (which will be the desired state),
    // initialTab (from storage or the new 'videos' default) will be used.
    // If a user had a *different* tab stored (e.g. 'selections'), that should still be respected.
    // The only case we want to override is if the *default from storage.get* needs to be applied
    // because there's no other valid stored preference.

    // Check if the initialTab (from storage or default 'videos') corresponds to an existing sidebar link.
    // If not, it might be an old value, so fall back to the new default 'videos'.
    const validTargets = Array.from(sidebarLinks).map(link => link.dataset.target);
    if (!validTargets.includes(initialTab)) {
        initialTab = 'videos'; // Fallback to new default if stored tab is no longer valid
    }

    setActiveContent(initialTab);
  });

  // Listener for changes in storage (bookmarks, settings, etc.)
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'local' && changes.bookmarks) {
      console.log('Bookmarks changed in storage, reloading options page list.');
      loadAndRenderBookmarks(); // This will re-render and re-apply D&D, etc.
    }
    // No specific action needed here for lastActiveOptionsTab change, it's for next load.
    // D&D setting changes are handled by its own listener.
    // Theme changes are handled by its own listener.
  });

  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');
  const importStatus = document.getElementById('importStatus');

  exportBtn.addEventListener('click', function() {
    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      const bookmarksToExport = data.bookmarks;
      if (bookmarksToExport.length === 0) {
        alert('No bookmarks to export.');
        return;
      }

      // Convert bookmarks to JSON string
      const jsonString = JSON.stringify(bookmarksToExport, null, 2); // null, 2 for pretty printing

      // Create a Blob from the JSON string
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-'); // YYYY-MM-DDTHH-MM-SS
      a.download = `advanced_bookmarker_export_${timestamp}.json`; // Filename for the export
      document.body.appendChild(a); // Append to body to make it clickable
      a.click(); // Programmatically click the anchor to trigger download

      // Clean up: remove anchor and revoke the object URL
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Bookmarks exported successfully.');
      // Optionally, provide user feedback on the options page itself, though alert/download is primary.
    });
  });

  importFile.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
      importStatus.textContent = 'No file selected.';
      return;
    }

    if (file.type !== 'application/json') {
      importStatus.textContent = 'Error: Please select a valid JSON file.';
      alert('Error: Please select a valid JSON file (.json).');
      event.target.value = ''; // Reset file input
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedBookmarks = JSON.parse(e.target.result);

        if (!Array.isArray(importedBookmarks)) {
          throw new Error("Imported data is not an array.");
        }

        // Basic validation of imported bookmark structure (first item is enough for a quick check)
        if (importedBookmarks.length > 0) {
          const firstBookmark = importedBookmarks[0];
          if (typeof firstBookmark.title === 'undefined' || 
              typeof firstBookmark.url === 'undefined' ||
              typeof firstBookmark.id === 'undefined' || // ID should ideally be present or regenerated
              typeof firstBookmark.added_date === 'undefined' // Date should be present
              // type is also important
             ) {
            throw new Error("Imported bookmarks have an invalid structure.");
          }
        }
        
        importStatus.textContent = `Found ${importedBookmarks.length} bookmarks to import. Processing...`;

        chrome.storage.local.get({ bookmarks: [] }, function(data) {
          let existingBookmarks = data.bookmarks;
          let newBookmarksCount = 0;
          let skippedDuplicatesCount = 0;
          
          // Create a Set of existing URLs for efficient duplicate checking
          const existingUrls = new Set(existingBookmarks.map(bm => bm.url));

          importedBookmarks.forEach(importedBm => {
            // Ensure imported bookmarks have unique IDs if they clash, or regenerate them
            // For simplicity, we'll assume IDs are unique or regenerate if necessary.
            // A more robust approach would check ID clashes with existing ones.
            // For now, prioritize existing if URL matches.
            if (!existingUrls.has(importedBm.url)) {
              // Ensure essential fields exist, provide defaults if missing and acceptable
              const newBm = {
                id: importedBm.id || 'id_' + new Date().getTime() + Math.random().toString(36).substr(2, 9), // Regenerate ID if missing
                title: importedBm.title || 'Untitled',
                url: importedBm.url,
                type: importedBm.type || 'page',
                added_date: importedBm.added_date || new Date().toISOString(),
                faviconUrl: importedBm.faviconUrl || null,
                thumbnailUrl: importedBm.thumbnailUrl || null,
                text: importedBm.text || null // For selections
              };
              existingBookmarks.unshift(newBm); // Add to beginning
              existingUrls.add(newBm.url); // Add to set to prevent duplicates from within the import file itself
              newBookmarksCount++;
            } else {
              skippedDuplicatesCount++;
            }
          });

          chrome.storage.local.set({ bookmarks: existingBookmarks }, function() {
            if (chrome.runtime.lastError) {
              importStatus.textContent = 'Error saving imported bookmarks.';
              console.error('Error saving imported bookmarks:', chrome.runtime.lastError);
              alert('An error occurred while saving imported bookmarks.');
            } else {
              const message = `Import successful! Added ${newBookmarksCount} new bookmarks. Skipped ${skippedDuplicatesCount} duplicates.`;
              importStatus.textContent = message;
              console.log(message);
              alert(message);
              loadAndRenderBookmarks(); // Refresh the displayed list
            }
            event.target.value = ''; // Reset file input
          });
        });

      } catch (error) {
        importStatus.textContent = `Error: ${error.message}`;
        console.error('Error importing bookmarks:', error);
        alert(`Error importing file: ${error.message}`);
        event.target.value = ''; // Reset file input
      }
    };

    reader.onerror = function() {
      importStatus.textContent = 'Error reading file.';
      alert('An error occurred while reading the file.');
      event.target.value = ''; // Reset file input
    };

    reader.readAsText(file);
  });

  // --- THEME SWITCHER ---
  const themeSelect = document.getElementById('themeSelect');

  function applyTheme(themeName) {
    let effectiveTheme = themeName;
    if (themeName === 'system_default') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark_mode' : 'light_pastel'; // Default to light_pastel if no system preference
    }
    document.body.setAttribute('data-theme', effectiveTheme);
    
    // Update the select dropdown to reflect the actual choice
    // If 'system_default' was chosen, keep it selected, otherwise select the directly chosen theme.
    themeSelect.value = themeName; 

    chrome.storage.local.set({ selectedTheme: themeName }); // Persist the user's *choice*
    console.log("Applied theme:", themeName, "Effective theme:", effectiveTheme);
  }

  themeSelect.addEventListener('change', function() {
    applyTheme(this.value);
  });

  // Load and apply saved theme on startup
  chrome.storage.local.get({ selectedTheme: 'light_pastel' }, function(data) { // Default to light_pastel
    applyTheme(data.selectedTheme);
  });
  
  // Optional: Listen for system theme changes to dynamically update if "System Default" is selected
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      // Only re-apply if 'system_default' is the *selected* option in the dropdown.
      if (themeSelect.value === 'system_default') {
          console.log("System theme changed, re-applying system_default.");
          applyTheme('system_default'); // Re-apply to pick up new system theme
      }
  });
});
