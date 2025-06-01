document.addEventListener('DOMContentLoaded', function() {
  const webpagesList = document.getElementById('webpagesList');
  const websitesList = document.getElementById('websitesList');
  const youtubeVideosList = document.getElementById('youtubeVideosList');
  const youtubeChannelsList = document.getElementById('youtubeChannelsList');
  const selectionsList = document.getElementById('selectionsList');

  // Folder list elements
  const webpagesFoldersList = document.getElementById('webpages-foldersList');
  const websitesFoldersList = document.getElementById('websites-foldersList');
  const videosFoldersList = document.getElementById('videos-foldersList');
  const channelsFoldersList = document.getElementById('channels-foldersList');
  const selectionsFoldersList = document.getElementById('selections-foldersList');

  // Sidebar navigation elements
  const sidebarLinks = document.querySelectorAll('.sidebar a');
  const contentSections = document.querySelectorAll('.main-content .content-section');
  const mainContentTitle = document.querySelector('.main-content > h1');
  const sidebar = document.querySelector('.sidebar'); // Added
  const optionsContainer = document.querySelector('.options-container'); // Added

  const dragDropToggle = document.getElementById('dragDropToggle');
  let dragDropEnabled = false;
  let draggedItem = null;
  let originalBookmarksOrder = [];

  // Function to update draggable attributes and visual cues
  function updateDraggableState(enabled) {
    const allBookmarkItems = document.querySelectorAll('.bookmark-item'); // Get all bookmark items, nested or not
    const allBookmarkLists = document.querySelectorAll('.bookmark-list'); // Get all bookmark lists

    allBookmarkLists.forEach(list => {
      if (enabled) {
        list.classList.add('dnd-enabled');
      } else {
        list.classList.remove('dnd-enabled');
      }
    });

    allBookmarkItems.forEach(item => {
        item.setAttribute('draggable', enabled ? 'true' : 'false');
    });
  }

  // --- DRAG AND DROP HANDLERS ---
  function handleDragStart(e) {
    if (!dragDropEnabled || !e.target.classList.contains('bookmark-item')) {
      e.preventDefault(); // Prevent dragging non-bookmark items or if D&D is off
      return;
    }
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
    e.dataTransfer.setData('text/type', draggedItem.dataset.type); // Store type for cross-section check
    e.dataTransfer.setData('text/sourcefolder', draggedItem.closest('.folder-item')?.dataset.id || 'root');

    setTimeout(() => {
      if (draggedItem) draggedItem.classList.add('dragging');
    }, 0);
    
    chrome.storage.local.get({ bookmarks: [] }, function(data) { // For reordering logic
      originalBookmarksOrder = data.bookmarks.map(bm => bm.id);
    });
  }

  function handleDragOver(e) {
    if (!dragDropEnabled || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const draggedItemType = draggedItem.dataset.type;
    let validTargetFound = false;

    // Check if over a bookmark item (for reordering)
    const targetBookmarkItem = e.target.closest('.bookmark-item');
    if (targetBookmarkItem && targetBookmarkItem !== draggedItem) {
        const targetList = targetBookmarkItem.closest('.bookmark-list');
        const targetListSectionType = targetList.dataset.sectionType || targetList.closest('.content-section').id.replace('content-', '');
         if (targetListSectionType === draggedItemType) { // Can only reorder within same type section
            validTargetFound = true;
            targetBookmarkItem.classList.add('drag-over');
         }
    }

    // Check if over a folder item
    const targetFolderItem = e.target.closest('.folder-item');
    if (targetFolderItem) {
        const folderSectionType = targetFolderItem.closest('.content-section').id.replace('content-', '');
        if (folderSectionType === draggedItemType) { // Type compatibility check
            validTargetFound = true;
            targetFolderItem.classList.add('drag-over');
        }
    }

    // Check if over a root bookmark list (but not over a specific item in it)
    const targetRootList = e.target.closest('.bookmark-list:not(.nested-bookmark-list)');
    if (targetRootList && !targetBookmarkItem && !targetFolderItem) { // Ensure not also over an item or folder
        const rootListSectionType = targetRootList.dataset.sectionType || targetRootList.closest('.content-section').id.replace('content-', '');
        if (rootListSectionType === draggedItemType) {
            validTargetFound = true;
            // Visual cue for list itself can be added if desired, e.g. targetRootList.classList.add('drag-over-list');
        }
    }

    // Clear previous drag-over highlights if not on a valid target anymore
    document.querySelectorAll('.bookmark-item.drag-over, .folder-item.drag-over').forEach(el => {
        if (el !== targetBookmarkItem && el !== targetFolderItem) {
            el.classList.remove('drag-over');
        }
    });
  }

  function handleDragLeave(e) {
    const el = e.target.closest('.bookmark-item, .folder-item');
    if (el) {
      el.classList.remove('drag-over');
    }
  }

  function handleDrop(e) {
    if (!dragDropEnabled || !draggedItem) return;
    e.preventDefault();
    document.querySelectorAll('.bookmark-item.drag-over, .folder-item.drag-over').forEach(el => el.classList.remove('drag-over'));

    const draggedItemId = e.dataTransfer.getData('text/plain');
    const draggedItemType = e.dataTransfer.getData('text/type');
    // const sourceFolderId = e.dataTransfer.getData('text/sourcefolder');

    const targetFolderItem = e.target.closest('.folder-item');
    const targetBookmarkItem = e.target.closest('.bookmark-item');
    const targetList = e.target.closest('.bookmark-list'); // Could be root or nested

    if (targetFolderItem) {
        const targetFolderId = targetFolderItem.dataset.id;
        const folderSectionType = targetFolderItem.closest('.content-section').id.replace('content-', '');
        if (draggedItemType === folderSectionType) {
            updateBookmarkFolder(draggedItemId, targetFolderId);
        } else { console.warn("Cannot move bookmark to a folder of a different section type."); }
    } else if (targetList && !targetBookmarkItem) { // Dropped on a list area, not an item
        const isRootList = !targetList.classList.contains('nested-bookmark-list');
        const listSectionType = targetList.dataset.sectionType || targetList.closest('.content-section').id.replace('content-', '');
        if (isRootList && draggedItemType === listSectionType) {
            updateBookmarkFolder(draggedItemId, 'root');
        } else if (!isRootList && draggedItemType === listSectionType) { // Dropped on nested list area
            const parentFolderId = targetList.closest('.folder-item')?.dataset.id;
            if (parentFolderId) updateBookmarkFolder(draggedItemId, parentFolderId);
        } else { console.warn("Drop on list area failed type or hierarchy check.");}
    } else if (targetBookmarkItem && targetBookmarkItem !== draggedItem) { // Dropped on another bookmark for reordering
        const listElement = targetBookmarkItem.closest('.bookmark-list');
        if (listElement) { // Ensure it's a valid list
            // Reordering logic: ensure items are in the same folder/root context
            const draggedItemFolderId = draggedItem.closest('.folder-item')?.dataset.id || 'root';
            const targetItemFolderId = targetBookmarkItem.closest('.folder-item')?.dataset.id || 'root';
            if (draggedItemFolderId === targetItemFolderId) {
                 const children = Array.from(listElement.children).filter(child => child.classList.contains('bookmark-item'));
                 const draggedIndex = children.indexOf(draggedItem);
                 const targetIndex = children.indexOf(targetBookmarkItem);
                 if (draggedIndex < targetIndex) {
                    listElement.insertBefore(draggedItem, targetBookmarkItem.nextSibling);
                 } else {
                    listElement.insertBefore(draggedItem, targetBookmarkItem);
                 }
                 updateStoredOrder(listElement, targetItemFolderId); // Pass folderId for context
            } else { console.warn("Cannot reorder items from different folders/root directly.");}
        }
    }
    draggedItem = null; // Clean up
  }

  function updateBookmarkFolder(bookmarkId, newFolderId) {
    chrome.storage.local.get({ bookmarks: [] }, function(data) {
        let bookmarks = data.bookmarks;
        const bookmarkIndex = bookmarks.findIndex(bm => bm.id === bookmarkId);
        if (bookmarkIndex !== -1) {
            bookmarks[bookmarkIndex].folderId = newFolderId;
            chrome.storage.local.set({ bookmarks: bookmarks }, function() {
                if (chrome.runtime.lastError) console.error("Error updating bookmark folderId:", chrome.runtime.lastError);
                // else console.log("Bookmark folderId updated"); // Handled by storage.onChanged
            });
        }
    });
  }

  function handleDragEnd(e) {
    if (draggedItem) { // Check if draggedItem was set (i.e., dragstart was successful)
      draggedItem.classList.remove('dragging');
    }
    document.querySelectorAll('.bookmark-item.drag-over, .folder-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedItem = null;
    originalBookmarksOrder = []; // Clear this as it's specific to a drag operation context
  }

  // Function to update chrome.storage.local with new order from a list
  // Now takes folderId to correctly re-order a subset of bookmarks
  function updateStoredOrder(listElement, folderContextId = 'root') {
    const newOrderedIdsInList = Array.from(listElement.children)
                                .filter(item => item.classList.contains('bookmark-item')) // Ensure only bookmark items
                                .map(item => item.dataset.id)
                                .filter(id => id);

    chrome.storage.local.get({ bookmarks: [] }, function(data) {
      let allBookmarks = data.bookmarks;
      // Separate bookmarks in the current context (folder or root) from others
      const bookmarksInContext = allBookmarks.filter(bm => (bm.folderId === folderContextId || (folderContextId === 'root' && (bm.folderId === 'root' || typeof bm.folderId === 'undefined' || bm.folderId === null))));
      const bookmarksNotInContext = allBookmarks.filter(bm => !(bm.folderId === folderContextId || (folderContextId === 'root' && (bm.folderId === 'root' || typeof bm.folderId === 'undefined' || bm.folderId === null))));

      // Create a map for easy lookup of bookmarks in the current context
      const contextBookmarkMap = new Map(bookmarksInContext.map(bm => [bm.id, bm]));

      // Build the reordered list for the current context
      let reorderedContextBookmarks = [];
      newOrderedIdsInList.forEach(id => {
        if (contextBookmarkMap.has(id)) {
          reorderedContextBookmarks.push(contextBookmarkMap.get(id));
        }
      });

      // Combine with bookmarks not in the current context
      // The order of bookmarksNotInContext relative to each other is preserved.
      // The reorderedContextBookmarks are effectively moved together as a block.
      const finalBookmarks = [...bookmarksNotInContext, ...reorderedContextBookmarks];

      chrome.storage.local.set({ bookmarks: finalBookmarks }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error updating bookmark order:", chrome.runtime.lastError);
        } else {
          console.log("Bookmark order updated successfully for context:", folderContextId);
        }
      });
    });
  }

  // Function to create a bookmark list item element
  function createBookmarkElement(bookmark) {
    const item = document.createElement('li');
    item.classList.add('bookmark-item');
    item.setAttribute('data-id', bookmark.id);
    item.setAttribute('data-type', bookmark.type); // Added data-type attribute

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

  // --- FOLDER CREATION ---
  function createNewFolder(name, sectionType) {
    chrome.storage.local.get({ folders: [] }, function(data) {
      const newFolder = {
        id: 'folder_' + new Date().getTime(),
        name: name,
        section: sectionType,
        parentId: null, // Top-level folder for now
        created_date: new Date().toISOString()
      };
      data.folders.push(newFolder);
      chrome.storage.local.set({ folders: data.folders }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error saving new folder:", chrome.runtime.lastError);
        } else {
          console.log("New folder created:", newFolder);
          // Re-rendering will be handled by storage.onChanged listener
        }
      });
    });
  }

  document.querySelectorAll('.create-folder-btn').forEach(button => {
    button.addEventListener('click', function() {
      const sectionType = this.dataset.sectionType;
      const folderName = prompt(`Enter name for new folder in ${sectionType}:`);
      if (folderName && folderName.trim() !== "") {
        createNewFolder(folderName.trim(), sectionType);
      }
    });
  });

  // Function to render folders and bookmarks for the active section
  function renderActiveSectionContent(activeTargetId, allBookmarks, allFolders) {
    const sectionMapping = {
      'videos': { bookmarkList: youtubeVideosList, folderList: videosFoldersList, type: 'youtube_video' },
      'channels': { bookmarkList: youtubeChannelsList, folderList: channelsFoldersList, type: 'youtube_channel' },
      'websites': { bookmarkList: websitesList, folderList: websitesFoldersList, type: 'website' },
      'webpages': { bookmarkList: webpagesList, folderList: webpagesFoldersList, type: 'page' },
      'selections': { bookmarkList: selectionsList, folderList: selectionsFoldersList, type: 'selection' }
    };

    // Clear all lists first (bookmarks and folders)
    Object.values(sectionMapping).forEach(mapping => {
      if(mapping.bookmarkList) mapping.bookmarkList.innerHTML = '';
      if(mapping.folderList) mapping.folderList.innerHTML = '';
    });

    const currentSectionMap = sectionMapping[activeTargetId];
    if (!currentSectionMap) {
      console.warn("No mapping found for section:", activeTargetId);
      return;
    }

    // Render Folders for the active section
    const sectionFolders = allFolders.filter(folder => folder.section === activeTargetId && (folder.parentId === null || folder.parentId === 'root')); // Assuming top-level for now
    if (currentSectionMap.folderList) {
      if (sectionFolders.length === 0) {
        currentSectionMap.folderList.innerHTML = '<li class="empty-list-placeholder">No folders yet.</li>';
      } else {
        sectionFolders.forEach(folder => {
          const folderItem = document.createElement('li');
          folderItem.classList.add('folder-item');
          folderItem.setAttribute('data-id', folder.id);
          folderItem.setAttribute('data-section-type', folder.section); // Store section type on folder for D&D checks
          folderItem.textContent = escapeHTML(folder.name);

          const nestedUl = document.createElement('ul');
          nestedUl.classList.add('bookmark-list', 'nested-bookmark-list');
          nestedUl.setAttribute('data-folder-id', folder.id); // For identifying this list later
          nestedUl.setAttribute('data-section-type', folder.section);


          const bookmarksInFolder = allBookmarks.filter(bm => bm.folderId === folder.id && bm.type === currentSectionMap.type);
          if (bookmarksInFolder.length === 0) {
            // Optional: placeholder for empty folder
            // const emptyMsg = document.createElement('li');
            // emptyMsg.classList.add('empty-list-placeholder', 'empty-folder-placeholder');
            // emptyMsg.textContent = 'Folder is empty.';
            // nestedUl.appendChild(emptyMsg);
          } else {
            bookmarksInFolder.forEach(bookmark => {
              const bookmarkElement = createBookmarkElement(bookmark);
              nestedUl.appendChild(bookmarkElement);
            });
          }
          folderItem.appendChild(nestedUl); // Add nested list to folder item
          currentSectionMap.folderList.appendChild(folderItem);
        });
      }
    }

    // Render Root Bookmarks for the active section
    const rootBookmarks = allBookmarks.filter(bookmark =>
      (bookmark.type === currentSectionMap.type || (activeTargetId === 'webpages' && bookmark.type === 'page')) &&
      (bookmark.folderId === 'root' || typeof bookmark.folderId === 'undefined' || bookmark.folderId === null)
    );

    if (currentSectionMap.bookmarkList) { // This is the root bookmark list for the section
      currentSectionMap.bookmarkList.setAttribute('data-section-type', activeTargetId); // For D&D checks
      if (rootBookmarks.length === 0 && sectionFolders.length === 0) { // Only show if no folders either
        currentSectionMap.bookmarkList.innerHTML = `<li class="empty-list-placeholder">No ${activeTargetId} bookmarked here yet.</li>`;
      } else if (rootBookmarks.length === 0 && sectionFolders.length > 0) {
        // If there are folders, don't show "no bookmarks here yet" in the root list if it's empty.
        // It might be confusing. Or, have a different message like "No items at root."
         currentSectionMap.bookmarkList.innerHTML = ''; // Clear any placeholder if folders exist
      }
      else {
        rootBookmarks.forEach(bookmark => {
          const bookmarkElement = createBookmarkElement(bookmark);
          currentSectionMap.bookmarkList.appendChild(bookmarkElement);
        });
      }
    }
    
    updateDraggableState(dragDropEnabled); 
    addListEventListeners(); 
  }

  // Load data and render content for the currently active section
  function loadAndRenderActiveSectionData() {
    const activeLink = document.querySelector('.sidebar a.active');
    const activeTargetId = activeLink ? activeLink.dataset.target : 'videos'; // Default to 'videos' if none active

    chrome.storage.local.get({ bookmarks: [], folders: [] }, function(data) {
      renderActiveSectionContent(activeTargetId, data.bookmarks, data.folders);
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
    // This function should remain targeted at bookmark lists for now.
    // Folder interactions (like click to open) will be separate.
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
  loadAndRenderActiveSectionData(); // Renamed function call

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
    if (namespace === 'local' && (changes.bookmarks || changes.folders)) {
      console.log('Bookmarks or folders changed in storage, reloading active section.');
      loadAndRenderActiveSectionData();
    }
    // Theme and D&D settings changes are handled by their own listeners or direct updates.
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

// --- UTILITY FUNCTIONS FOR SORTING ---
function sortBookmarksByDate(bookmarks, ascending = true) {
  if (!Array.isArray(bookmarks)) return [];
  // Create a shallow copy to avoid modifying the original array if it's passed by reference from state
  return [...bookmarks].sort((a, b) => {
    const dateA = new Date(a.added_date);
    const dateB = new Date(b.added_date);
    if (ascending) {
      return dateA - dateB;
    } else {
      return dateB - dateA;
    }
  });
}

function sortBookmarksByTitle(bookmarks, ascending = true) {
  if (!Array.isArray(bookmarks)) return [];
  // Create a shallow copy
  return [...bookmarks].sort((a, b) => {
    const titleA = a.title ? String(a.title).toLowerCase() : '';
    const titleB = b.title ? String(b.title).toLowerCase() : '';
    if (titleA < titleB) {
      return ascending ? -1 : 1;
    }
    if (titleA > titleB) {
      return ascending ? 1 : -1;
    }
    return 0;
  });
}
