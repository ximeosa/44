document.addEventListener('DOMContentLoaded', function() {
  const webpagesList = document.getElementById('webpagesList');
  const websitesList = document.getElementById('websitesList');
  const youtubeVideosList = document.getElementById('youtubeVideosList');
  const youtubeChannelsList = document.getElementById('youtubeChannelsList');
  const selectionsList = document.getElementById('selectionsList');

  // Sidebar navigation elements
  const sidebarLinks = document.querySelectorAll('.sidebar a');
  const contentSections = document.querySelectorAll('.main-content .content-section');
  const mainContentTitle = document.querySelector('.main-content > h1');
  const sidebarLinks = document.querySelectorAll('.sidebar a');
  const contentSections = document.querySelectorAll('.main-content .content-section');
  const mainContentTitle = document.querySelector('.main-content > h1');
  const sidebar = document.querySelector('.sidebar');
  const optionsContainer = document.querySelector('.options-container');

  let dragDropToggle = document.getElementById('dragDropToggle'); // Initial attempt to get it

  let dragDropEnabled = false;
  let draggedItem = null;
  let originalBookmarksOrder = [];

  // Function to update draggable attributes and visual cues
  function updateDraggableState(enabled) {
    const bookmarkLists = [webpagesList, websitesList, youtubeVideosList, youtubeChannelsList, selectionsList];
    bookmarkLists.forEach(list => {
      if (!list) return;
      if (enabled) {
        list.classList.add('dnd-enabled');
      } else {
        list.classList.remove('dnd-enabled');
      }
      Array.from(list.children).forEach(item => {
        if (item.classList.contains('bookmark-item')) {
          item.setAttribute('draggable', enabled ? 'true' : 'false');
        }
      });
    });
  }

  // --- DRAG AND DROP HANDLERS ---
  function handleDragStart(e) {
    if (!dragDropEnabled || !e.target.classList.contains('bookmark-item')) {
      e.preventDefault();
      return;
    }
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
    // No longer setting text/type or text/sourcefolder as folders are removed

    setTimeout(() => {
      if (draggedItem) draggedItem.classList.add('dragging');
    }, 0);
    
    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      originalBookmarksOrder = data.bookmarks.map(bm => bm.id);
    });
  }

  function handleDragOver(e) {
    if (!dragDropEnabled || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const targetItem = e.target.closest('.bookmark-item');
    // Only allow dropping on another bookmark item within the same list for reordering
    if (targetItem && targetItem !== draggedItem && targetItem.parentElement === draggedItem.parentElement) {
      Array.from(draggedItem.parentElement.children).forEach(child => {
        if (child.classList.contains('bookmark-item')) child.classList.remove('drag-over');
      });
      targetItem.classList.add('drag-over');
    } else {
      // Clear drag-over from other items if not a valid reorder target
      document.querySelectorAll('.bookmark-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
  }

  function handleDragLeave(e) {
    const el = e.target.closest('.bookmark-item');
    if (el) {
      el.classList.remove('drag-over');
    }
  }

  function handleDrop(e) {
    if (!dragDropEnabled || !draggedItem) return;
    e.preventDefault();
    document.querySelectorAll('.bookmark-item.drag-over').forEach(el => el.classList.remove('drag-over'));

    const targetItem = e.target.closest('.bookmark-item');
    const targetList = e.target.closest('.bookmark-list');

    if (targetList && targetItem && targetItem !== draggedItem && targetItem.parentElement === draggedItem.parentElement) {
      // Reordering within the same list
      const listElement = targetItem.parentElement;
      const children = Array.from(listElement.children).filter(child => child.classList.contains('bookmark-item'));
      const draggedIndex = children.indexOf(draggedItem);
      const targetIndex = children.indexOf(targetItem);

      if (draggedIndex < targetIndex) {
        listElement.insertBefore(draggedItem, targetItem.nextSibling);
      } else {
        listElement.insertBefore(draggedItem, targetItem);
      }
      updateStoredOrder(listElement); // Simplified updateStoredOrder
    } else if (targetList && !targetItem && targetList === draggedItem.parentElement) {
      // Dropped on the list itself (empty area) - append to end
      targetList.appendChild(draggedItem);
      updateStoredOrder(targetList); // Simplified updateStoredOrder
    }
    // Dropping on folders or changing folderId is removed.
    draggedItem = null;
  }

  function handleDragEnd(e) {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
    }
    document.querySelectorAll('.bookmark-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedItem = null;
    originalBookmarksOrder = [];
  }

  // Simplified function to update chrome.storage.local with new order from a list
  function updateStoredOrder(listElement) {
    const newOrderedIdsInList = Array.from(listElement.children)
                                .filter(item => item.classList.contains('bookmark-item'))
                                .map(item => item.dataset.id)
                                .filter(id => id);

    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      let allBookmarks = data.bookmarks;
      const bookmarkMap = new Map(allBookmarks.map(bm => [bm.id, bm]));
      let reorderedBookmarks = [];
      let usedIds = new Set();

      newOrderedIdsInList.forEach(id => {
        if (bookmarkMap.has(id)) {
          reorderedBookmarks.push(bookmarkMap.get(id));
          usedIds.add(id);
        }
      });

      // Add any bookmarks not in this specific list (e.g., from other sections)
      // This part might need refinement if lists are section-specific and not global
      allBookmarks.forEach(bm => {
        if (!usedIds.has(bm.id)) {
          reorderedBookmarks.push(bm);
        }
      });

      // A more robust way for section-specific reordering:
      // We assume `listElement` belongs to a specific section.
      // So, we only reorder items of that section.
      const sectionType = listElement.dataset.sectionType || listElement.closest('.content-section').id.replace('content-', '');

      const bookmarksOfSection = allBookmarks.filter(bm => {
          if (sectionType === 'videos') return bm.type === 'youtube_video';
          if (sectionType === 'channels') return bm.type === 'youtube_channel';
          return bm.type === sectionType;
      });
      const otherBookmarks = allBookmarks.filter(bm => {
          if (sectionType === 'videos') return bm.type !== 'youtube_video';
          if (sectionType === 'channels') return bm.type !== 'youtube_channel';
          return bm.type !== sectionType;
      });

      const sectionMap = new Map(bookmarksOfSection.map(bm => [bm.id, bm]));
      let reorderedSectionBookmarks = [];
      newOrderedIdsInList.forEach(id => {
          if(sectionMap.has(id)){
              reorderedSectionBookmarks.push(sectionMap.get(id));
              sectionMap.delete(id); // Remove from map to handle items not in listElement
          }
      });
      // Add back any items from this section that were not in listElement (should not happen if list is complete)
      sectionMap.forEach(bm => reorderedSectionBookmarks.push(bm));


      const finalBookmarks = [...otherBookmarks, ...reorderedSectionBookmarks];


      chrome.storage.local.set({ bookmarks: finalBookmarks }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error updating bookmark order:", chrome.runtime.lastError);
        } else {
          console.log("Bookmark order updated successfully for section:", sectionType);
        }
      });
    });
  }

  // Function to create a bookmark list item element
  function createBookmarkElement(bookmark) {
    item.classList.add('bookmark-item');
    item.setAttribute('data-id', bookmark.id);
    item.setAttribute('data-type', bookmark.type);
    // Removed folderId related attributes or logic from here

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

  // --- SORTING UTILITY FUNCTIONS ---
  function sortBookmarksByDate(bookmarks, ascending = true) {
    if (!Array.isArray(bookmarks)) return [];
    return [...bookmarks].sort((a, b) => {
      const dateA = new Date(a.added_date);
      const dateB = new Date(b.added_date);
      return ascending ? dateA - dateB : dateB - dateA;
    });
  }

  function sortBookmarksByTitle(bookmarks, ascending = true) {
    if (!Array.isArray(bookmarks)) return [];
    return [...bookmarks].sort((a, b) => {
      const titleA = a.title ? String(a.title).toLowerCase() : '';
      const titleB = b.title ? String(b.title).toLowerCase() : '';
      if (titleA < titleB) return ascending ? -1 : 1;
      if (titleA > titleB) return ascending ? 1 : -1;
      return 0;
    });
  }

  const defaultSort = { by: 'date', order: 'desc' };

  function updateSortButtonActiveState(sectionId, sortBy, sortOrder) {
    const sortButtonContainer = document.querySelector(`#content-${sectionId} .sort-options`);
    if (!sortButtonContainer) return;

    sortButtonContainer.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.remove('active-sort');
      if (btn.dataset.sortBy === sortBy && btn.dataset.sortOrder === sortOrder) {
        btn.classList.add('active-sort');
      }
    });
  }

  // Simplified rendering function for a specific list
  function populateBookmarkList(listElement, bookmarksToRender, sectionId) {
    if (!listElement) return;
    listElement.innerHTML = ''; // Clear previous items
    if (bookmarksToRender.length === 0) {
      listElement.innerHTML = `<li class="empty-list-placeholder">No ${sectionId} bookmarked yet.</li>`;
    } else {
      bookmarksToRender.forEach(bookmark => {
        const bookmarkElement = createBookmarkElement(bookmark);
        listElement.appendChild(bookmarkElement);
      });
    }
  }

  // Main function to load, sort, and render bookmarks for the active section
  function loadSortAndRenderActiveSection() {
    const activeLink = document.querySelector('.sidebar a.active');
    const activeTargetId = activeLink ? activeLink.dataset.target : 'videos'; // Default section

    const sectionMapping = {
      'videos': { listElement: youtubeVideosList, type: 'youtube_video' },
      'channels': { listElement: youtubeChannelsList, type: 'youtube_channel' },
      'websites': { listElement: websitesList, type: 'website' },
      'webpages': { listElement: webpagesList, type: 'page' },
      'selections': { listElement: selectionsList, type: 'selection' }
    };

    if (!sectionMapping[activeTargetId]) return; // Should not happen if activeTargetId is valid

    chrome.storage.local.get({ bookmarks: [], sortPreferences: {} }, function(data) {
      const allBookmarks = data.bookmarks;
      const sortPreferences = data.sortPreferences;

      const currentSort = sortPreferences[activeTargetId] || defaultSort;

      let sectionBookmarks = allBookmarks.filter(bm => {
        if (activeTargetId === 'videos') return bm.type === 'youtube_video';
        if (activeTargetId === 'channels') return bm.type === 'youtube_channel';
        return bm.type === activeTargetId;
      });

      if (currentSort.by === 'date') {
        sectionBookmarks = sortBookmarksByDate(sectionBookmarks, currentSort.order === 'asc');
      } else if (currentSort.by === 'title') {
        sectionBookmarks = sortBookmarksByTitle(sectionBookmarks, currentSort.order === 'asc');
      }

      populateBookmarkList(sectionMapping[activeTargetId].listElement, sectionBookmarks, activeTargetId);
      updateSortButtonActiveState(activeTargetId, currentSort.by, currentSort.order);

      // Ensure D&D state is applied after rendering
      updateDraggableState(dragDropEnabled);
      addListEventListeners(); // Re-attach D&D listeners to the newly rendered items
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
    const bookmarkLists = [webpagesList, websitesList, youtubeVideosList, youtubeChannelsList, selectionsList];
    bookmarkLists.forEach(list => {
      if (!list) return;
      // Delete listener (event delegation)
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
    chrome.storage.local.set({ lastActiveOptionsTab: targetId }, function() {
      // After setting the active tab and updating UI classes, load/sort/render its content
      loadSortAndRenderActiveSection();
    });
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      const target = this.dataset.target;
      setActiveContent(target); // This will now also trigger re-render for the new section
    });
  });

  // Initial load & State Restoration
  // The D&D toggle might not be in the DOM yet if it's moved by HTML changes.
  // Query for it here, after potential HTML modification.
  // This will be done after HTML is modified. For now, ensure logic is sound.
  // dragDropToggle = document.getElementById('dragDropToggle');  // Moved to after DOMContentLoaded
  // if (dragDropToggle) { ... } // Moved to after DOMContentLoaded


  // Restore last active tab or default to 'videos'. This will also trigger the first render.
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
    if (namespace === 'local' && (changes.bookmarks || changes.sortPreferences)) {
      console.log('Bookmarks or sort preferences changed in storage, reloading active section.');
      loadSortAndRenderActiveSection();
    }
    // Handling D&D toggle change is done directly by its event listener.
  });

  // Event listener for sort buttons (using event delegation)
  const mainContentArea = document.querySelector('.main-content');
  if (mainContentArea) {
    mainContentArea.addEventListener('click', function(event) {
      if (event.target.classList.contains('sort-btn')) {
        const button = event.target;
        const sortBy = button.dataset.sortBy;
        const sortOrder = button.dataset.sortOrder;
        const activeSectionDiv = button.closest('.content-section');
        if (activeSectionDiv) {
          const activeSectionId = activeSectionDiv.id.replace('content-', '');

          chrome.storage.local.get({ sortPreferences: {} }, function(data) {
            let prefs = data.sortPreferences;
            prefs[activeSectionId] = { by: sortBy, order: sortOrder };
            chrome.storage.local.set({ sortPreferences: prefs }, function() {
              if(chrome.runtime.lastError) console.error("Error saving sort preference:", chrome.runtime.lastError);
              // The storage.onChanged listener will handle re-rendering.
            });
          });
        }
      }
    });
  }

  // Initialize D&D Toggle after DOM is loaded and HTML modifications are complete
  // This was previously outside/before this logic, but moved here
  // to ensure it's found after HTML is potentially modified by earlier steps.
  dragDropToggle = document.getElementById('dragDropToggle');
  if (dragDropToggle) {
    dragDropToggle.addEventListener('change', function() {
      dragDropEnabled = this.checked;
      updateDraggableState(dragDropEnabled);
      chrome.storage.local.set({ dragDropEnabledSetting: dragDropEnabled });
    });

    // Load and apply saved D&D enabled state
    chrome.storage.local.get({ dragDropEnabledSetting: false }, function(data) {
      if (dragDropToggle) { // Check again as it's an async callback
        dragDropEnabled = data.dragDropEnabledSetting;
        dragDropToggle.checked = dragDropEnabled;
        updateDraggableState(dragDropEnabled); // Apply initial state after loading
      }
    });
  } else {
    console.error("#dragDropToggle input element not found in the DOM! D&D toggle functionality will be unavailable.");
  }

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
              alert(message); // Alert remains for immediate user feedback.

              // Auto-dismiss the importStatus message after 7 seconds for success.
              setTimeout(() => {
                if (importStatus.textContent === message) { // Only clear if it's still the success message
                  importStatus.textContent = '';
                }
              }, 7000);

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

// Sorting functions are removed as per instruction
