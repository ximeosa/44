// Helper function to transform YouTube channel image URLs
function transformYouTubeChannelImageUrl(urlString) {
  if (urlString && urlString.includes("yt3.ggpht.com/")) {
    // Regex to find existing size parameter (e.g., =s48, =s88, =s100) and replace it
    // It also handles cases with -c-k-c0x00ffffff-no-rj or similar suffixes
    // and ensures it doesn't transform if it's already =s900 (to avoid re-logging)
    const sizePattern = /(=s\d+)(-c-k-c0x00ffffff-no-rj\w*)?$/;
    if (urlString.match(sizePattern) && !urlString.includes("=s900")) {
      const transformedUrl = urlString.replace(sizePattern, "=s900$2");
      // console.log('[CS_TransformImg] Transformed YT channel image URL:', urlString, '->', transformedUrl);
      return transformedUrl;
    }
  }
  return urlString; // Return original if no transformation applied
}

// Function to extract initial page info (favicon, main thumbnail, etc.)
function extractInitialPageInfo() {
  let result = {
    faviconUrl: null,
    thumbnailUrl: null,
    pageTitle: document.title,
    extractedChannelUrl: null, // For channel info from video page
    extractedChannelTitle: null, // For channel info from video page
    // Initialize debug fields
    debug_cs_isWatchPage: false,
    debug_cs_channelImgFound: false,
    debug_cs_channelImgSrc: null,
    debug_cs_channelLinkElementFound: false,
    debug_cs_channelLinkElementHref: null,
    debug_cs_channelNameElementFound: false,
    debug_cs_channelNameContent: null,
    debug_cs_usedFallbackChannelTitle: false,
    debug_cs_fallbackChannelTitle: null
  };

  // 1. Try to get favicon
  const faviconSelectors = [
    "link[rel='icon']",
    "link[rel='shortcut icon']",
    "link[rel='apple-touch-icon']",
    "link[rel='apple-touch-icon-precomposed']"
  ];
  for (let selector of faviconSelectors) {
    const iconLink = document.querySelector(selector);
    if (iconLink && iconLink.href) {
      result.faviconUrl = iconLink.href;
      break;
    }
  }
  if (!result.faviconUrl && window.location.origin) { // Ensure origin exists before creating URL
    try { result.faviconUrl = new URL('/favicon.ico', window.location.origin).href; } catch(e) { console.warn("Error creating favicon URL:", e); }
  }

  // 2. Try to get a representative thumbnail (Open Graph, Twitter Card)
  const ogImage = document.querySelector("meta[property='og:image']");
  if (ogImage && ogImage.content) {
    result.thumbnailUrl = ogImage.content;
  } else {
    const twitterImage = document.querySelector("meta[name='twitter:image']");
    if (twitterImage && twitterImage.content) {
      result.thumbnailUrl = twitterImage.content;
    }
  }

  // 3. Special handling for YouTube video page specifics
  if (window.location.hostname.includes("youtube.com") && window.location.pathname.includes("/watch")) {
    result.debug_cs_isWatchPage = true;
    console.log('[CS_ExtractInfo_VideoPage] Processing as video page.');

    const performP1ActualExtraction = (currentResultToUpdate) => {
        const videoId = new URLSearchParams(window.location.search).get('v');
        console.log('[CS_ExtractInfo_VideoPage_P1Func] videoId:', videoId);

        // Video Page Title Extraction
        let specificVideoTitleElement = document.querySelector('ytd-watch-metadata .title yt-formatted-string, h1.ytd-watch-metadata yt-formatted-string');
        if (specificVideoTitleElement && specificVideoTitleElement.textContent) {
            currentResultToUpdate.pageTitle = specificVideoTitleElement.textContent.trim();
            console.log('[CS_ExtractInfo_VideoPage_P1Func] Used specific selector for video pageTitle:', currentResultToUpdate.pageTitle);
        } else {
            currentResultToUpdate.pageTitle = document.title.replace(/ - YouTube$/, '').trim(); // Cleaned document.title as fallback
            console.log('[CS_ExtractInfo_VideoPage_P1Func] Used document.title for video pageTitle:', currentResultToUpdate.pageTitle);
        }
        currentResultToUpdate.debug_cs_pageTitle = currentResultToUpdate.pageTitle; // Store for debugging

        if (videoId) {
          // Video Page Thumbnail Extraction
          const ogImage = document.querySelector("meta[property='og:image']");
          const imageSrcLink = document.querySelector("link[rel='image_src']");
          if (ogImage && ogImage.content) {
            currentResultToUpdate.thumbnailUrl = ogImage.content;
            console.log('[CS_ExtractInfo_VideoPage_P1Func] Used og:image for video thumbnailUrl:', currentResultToUpdate.thumbnailUrl);
          } else if (imageSrcLink && imageSrcLink.href) {
            currentResultToUpdate.thumbnailUrl = imageSrcLink.href;
            console.log('[CS_ExtractInfo_VideoPage_P1Func] Used link[rel="image_src"] for video thumbnailUrl:', currentResultToUpdate.thumbnailUrl);
          } else {
            currentResultToUpdate.thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
            console.log('[CS_ExtractInfo_VideoPage_P1Func] Used maxresdefault.jpg for video thumbnailUrl:', currentResultToUpdate.thumbnailUrl);
          }
          currentResultToUpdate.debug_cs_thumbnailUrl = currentResultToUpdate.thumbnailUrl; // Store for debugging

          // --- MODIFICATION FOR CHANNEL AVATAR (FAVICON) AND CHANNEL LINK/TITLE ---
          console.log('[CS_ExtractInfo_VideoPage_P1Func] Attempting to extract channel avatar, link, and title.');

          // Channel Image (Avatar) Extraction
          const channelImgSelectors_P1 = [
              'ytd-video-owner-renderer #avatar img',
              'ytd-video-owner-renderer .channel-thumbnail-override img',
              '#owner #avatar img'
          ];
          let channelImg = null;
          let specificFaviconFound = false;
          for (const selector of channelImgSelectors_P1) {
              channelImg = document.querySelector(selector);
              if (channelImg && channelImg.src) {
                  currentResultToUpdate.faviconUrl = transformYouTubeChannelImageUrl(channelImg.src); // Transformed
                  specificFaviconFound = true;
                  currentResultToUpdate.debug_cs_channelImgFound = true;
                  currentResultToUpdate.debug_cs_channelImgSrc = currentResultToUpdate.faviconUrl; // Store transformed
                  console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Avatar (favicon) found and transformed with selector:', selector, 'Src:', currentResultToUpdate.faviconUrl);
                  break;
              } else {
                  console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Avatar (favicon) NOT found with selector:', selector);
              }
          }
          if (!specificFaviconFound) {
              console.log('[CS_ExtractInfo_VideoPage_P1Func] No specific channel avatar found. Existing result.faviconUrl (if any) will be used:', currentResultToUpdate.faviconUrl);
              if (!currentResultToUpdate.faviconUrl || currentResultToUpdate.faviconUrl.includes('favicon.ico')) {
                   currentResultToUpdate.debug_cs_channelImgFound = false;
                   currentResultToUpdate.debug_cs_channelImgSrc = null;
              }
          }

          // Channel Link and Title Extraction
          const channelLinkSelectors_P1 = [
              'yt-formatted-string#channel-name.ytd-video-owner-renderer a.yt-simple-endpoint',
              'div#owner yt-formatted-string#channel-name a.yt-simple-endpoint',
              'ytd-video-owner-renderer > a.yt-simple-endpoint.ytd-video-owner-renderer',
              '#owner ytd-video-owner-renderer > a.yt-simple-endpoint',
              'ytd-video-owner-renderer .ytd-channel-name a.yt-simple-endpoint',
              '#meta-contents .ytd-video-owner-renderer #channel-name a.yt-simple-endpoint'
          ];
          let channelLinkElement = null;
          currentResultToUpdate.extractedChannelUrl = null;
          currentResultToUpdate.debug_cs_channelLinkElementFound = false;
          currentResultToUpdate.debug_cs_channelLinkElementHref = null;

          for (const selector of channelLinkSelectors_P1) {
              channelLinkElement = document.querySelector(selector);
              if (channelLinkElement && channelLinkElement.href) {
                  currentResultToUpdate.extractedChannelUrl = channelLinkElement.href;
                  currentResultToUpdate.debug_cs_channelLinkElementFound = true;
                  currentResultToUpdate.debug_cs_channelLinkElementHref = currentResultToUpdate.extractedChannelUrl;
                  console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Link Element found with selector:', selector, 'Href:', currentResultToUpdate.extractedChannelUrl);
                  break;
              } else {
                  console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Link Element NOT found with selector:', selector);
              }
          }

          currentResultToUpdate.extractedChannelTitle = null;
          currentResultToUpdate.debug_cs_channelNameElementFound = false;
          currentResultToUpdate.debug_cs_channelNameContent = null;
          currentResultToUpdate.debug_cs_usedFallbackChannelTitle = false;
          currentResultToUpdate.debug_cs_fallbackChannelTitle = null;

          if (channelLinkElement) {
              console.log('[CS_ExtractInfo_VideoPage_P1Func] Attempting to extract channel title from found link element.');
              const channelNameSelectors_P1 = [
                  'yt-formatted-string#text',
                  'span'
              ];
              let channelNameElement = null;
              for (const selector of channelNameSelectors_P1) {
                  channelNameElement = channelLinkElement.querySelector(selector);
                  if (channelNameElement && channelNameElement.textContent?.trim()) {
                      currentResultToUpdate.extractedChannelTitle = channelNameElement.textContent.trim();
                      currentResultToUpdate.debug_cs_channelNameElementFound = true;
                      currentResultToUpdate.debug_cs_channelNameContent = currentResultToUpdate.extractedChannelTitle;
                      console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Title found via child selector:', selector, 'Title:', currentResultToUpdate.extractedChannelTitle);
                      break;
                  }
              }

              if (!currentResultToUpdate.extractedChannelTitle && channelLinkElement.textContent?.trim()) {
                  const linkText = channelLinkElement.textContent.trim();
                  if (linkText.length < 100 && !/subscribe|view replies|comments/i.test(linkText)) {
                      currentResultToUpdate.extractedChannelTitle = linkText;
                      currentResultToUpdate.debug_cs_usedFallbackChannelTitle = true;
                      currentResultToUpdate.debug_cs_fallbackChannelTitle = currentResultToUpdate.extractedChannelTitle;
                      if (!currentResultToUpdate.debug_cs_channelNameContent) currentResultToUpdate.debug_cs_channelNameContent = currentResultToUpdate.extractedChannelTitle;
                      console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Title extracted from link.textContent. Title:', currentResultToUpdate.extractedChannelTitle);
                  } else {
                       console.log('[CS_ExtractInfo_VideoPage_P1Func] link.textContent ("', linkText ,'") was too long or seemed non-descriptive, not used for title.');
                  }
              }

              if (!currentResultToUpdate.extractedChannelTitle && currentResultToUpdate.extractedChannelUrl) {
                  console.log('[CS_ExtractInfo_VideoPage_P1Func] Attempting to parse Channel Title from URL:', currentResultToUpdate.extractedChannelUrl);
                  try {
                      let pathName = new URL(currentResultToUpdate.extractedChannelUrl).pathname.split('/').pop();
                      if (pathName) {
                          currentResultToUpdate.extractedChannelTitle = pathName.startsWith('@') ? pathName.substring(1) : pathName;
                          currentResultToUpdate.debug_cs_usedFallbackChannelTitle = true;
                          currentResultToUpdate.debug_cs_fallbackChannelTitle = currentResultToUpdate.extractedChannelTitle;
                          if (!currentResultToUpdate.debug_cs_channelNameContent) currentResultToUpdate.debug_cs_channelNameContent = currentResultToUpdate.extractedChannelTitle;
                          console.log('[CS_ExtractInfo_VideoPage_P1Func] Channel Title parsed from URL. Title:', currentResultToUpdate.extractedChannelTitle);
                      }
                  } catch (e) {
                      console.warn('[CS_ExtractInfo_VideoPage_P1Func] Error parsing channel link for title fallback:', e);
                  }
              }
          } else {
              console.log('[CS_ExtractInfo_VideoPage_P1Func] No Channel Link Element found, cannot extract channel title.');
          }

          if (!currentResultToUpdate.extractedChannelUrl) {
              console.warn('[CS_ExtractInfo_VideoPage_P1Func] FINAL: extractedChannelUrl is NULL.');
          }
          if (!currentResultToUpdate.extractedChannelTitle) {
              console.warn('[CS_ExtractInfo_VideoPage_P1Func] FINAL: extractedChannelTitle is NULL.');
          }
          // --- END OF MODIFICATION ---
        } else {
          console.log('[CS_ExtractInfo_VideoPage_P1Func] Video ID not found in URL parameters. Cannot perform full P1 extraction.');
           // All debug_cs_ fields for video page specifics remain as initially set (false/null) for currentResultToUpdate
        }
        // Ensure URLs are absolute before sending
        try {
            if (currentResultToUpdate.faviconUrl && !currentResultToUpdate.faviconUrl.startsWith('http') && !currentResultToUpdate.faviconUrl.startsWith('data:') && window.location.origin) { currentResultToUpdate.faviconUrl = new URL(currentResultToUpdate.faviconUrl, window.location.origin).href; }
            if (currentResultToUpdate.thumbnailUrl && !currentResultToUpdate.thumbnailUrl.startsWith('http') && !currentResultToUpdate.thumbnailUrl.startsWith('data:') && window.location.origin) { currentResultToUpdate.thumbnailUrl = new URL(currentResultToUpdate.thumbnailUrl, window.location.origin).href; }
            if (currentResultToUpdate.extractedChannelUrl && !currentResultToUpdate.extractedChannelUrl.startsWith('http') && !currentResultToUpdate.extractedChannelUrl.startsWith('data:') && window.location.origin) { currentResultToUpdate.extractedChannelUrl = new URL(currentResultToUpdate.extractedChannelUrl, window.location.origin).href; }
        } catch (e) {
            console.warn("[CS_ExtractInfo_VideoPage_P1Func] Error constructing absolute URL:", e);
        }
        console.log('[CS_ExtractInfo_VideoPage_P1Func] P1 Extraction attempt complete. Sending message to background.');
        chrome.runtime.sendMessage({ action: "extractedPageInfo", data: currentResultToUpdate });
    };

    const keyP1ElementSelector = 'ytd-video-owner-renderer';
    let p1Retries = 0;
    const maxRetries_p1 = 30; // Approx 3 seconds (30 * 100ms)
    const pollInterval_p1 = 100; // 100ms

    const checkForKeyElement_p1 = () => {
        console.log('[CS_ExtractInfo_VideoPage] Polling for P1 key element:', keyP1ElementSelector, 'Attempt:', p1Retries + 1);
        if (document.querySelector(keyP1ElementSelector)) {
            console.log('[CS_ExtractInfo_VideoPage] P1 key element found. Performing P1 extraction.');
            performP1ActualExtraction(result);
        } else {
            p1Retries++;
            if (p1Retries < maxRetries_p1) {
                setTimeout(checkForKeyElement_p1, pollInterval_p1);
            } else {
                console.log('[CS_ExtractInfo_VideoPage] P1 key element not found after max retries. Performing P1 extraction anyway (best effort).');
                performP1ActualExtraction(result); // Attempt extraction even if key element is missing
            }
        }
    };
    checkForKeyElement_p1(); // Start polling
  }
  // 4. Special handling for YouTube channel page specifics
  else if (window.location.hostname.includes("youtube.com") && (window.location.pathname.startsWith("/channel/") || window.location.pathname.startsWith("/@"))) {
    console.log('[CS_ExtractInfo_ChannelPage] Processing as channel page.');
    result.debug_cs_isWatchPage = false; // Ensure this is false for channel pages

    result.extractedChannelUrl = window.location.href;
    console.log('[CS_ExtractInfo_ChannelPage] result.extractedChannelUrl set to:', result.extractedChannelUrl);

    const specificChannelTitleElement = document.querySelector('yt-formatted-string#text.ytd-channel-name, yt-formatted-string.ytd-channel-name.ytd-c4-tabbed-header-renderer, #channel-header yt-formatted-string#text.ytd-channel-name, #name yt-formatted-string#text');
    console.log('[CS_ExtractInfo_ChannelPage] specificChannelTitleElement found:', specificChannelTitleElement);
    if (specificChannelTitleElement && specificChannelTitleElement.textContent) {
        result.pageTitle = specificChannelTitleElement.textContent.trim();
        result.extractedChannelTitle = result.pageTitle; // Keep this consistent
    } else {
        result.pageTitle = document.title.replace(/ - YouTube$/, '').trim(); // Fallback to cleaned document.title
        result.extractedChannelTitle = result.pageTitle; // Keep this consistent
    }
    console.log('[CS_ExtractInfo_ChannelPage] result.pageTitle (for channel) set to:', result.pageTitle);
    
    result.debug_cs_channelLinkElementFound = true;
    result.debug_cs_channelLinkElementHref = result.extractedChannelUrl;
    result.debug_cs_channelNameElementFound = !!specificChannelTitleElement;
    result.debug_cs_channelNameContent = result.extractedChannelTitle;
    result.debug_cs_usedFallbackChannelTitle = !specificChannelTitleElement;

    const channelAvatarSelectors = [
        '#avatar.ytd-c4-tabbed-header-renderer img',
        'yt-img-shadow#avatar img',
        '#channel-header #avatar img',
        'img.channel-header-profile-image-container'
    ];
    let channelIcon = null;
    for (const selector of channelAvatarSelectors) {
        channelIcon = document.querySelector(selector);
        if (channelIcon) {
            console.log('[CS_ExtractInfo_ChannelPage] Channel avatar found with selector:', selector);
            break;
        }
    }

    if (channelIcon && channelIcon.src) {
      result.faviconUrl = transformYouTubeChannelImageUrl(channelIcon.src); // Transformed
      // Initially set thumbnail to transformed avatar, in case banner isn't found or is same.
      result.thumbnailUrl = result.faviconUrl;
      result.debug_cs_channelImgFound = true;
      result.debug_cs_channelImgSrc = result.faviconUrl; // Store transformed
      
      const channelBannerSelectors = [
        '#banner.ytd-c4-tabbed-header-renderer img',
        'tp-yt-profile-header-renderer #banner img',
        '#header #banner img',
        'img.style-scope.ytd-channel-banner'
      ];
      let channelBanner = null;
      for (const selector of channelBannerSelectors) {
          channelBanner = document.querySelector(selector);
          if (channelBanner) {
              console.log('[CS_ExtractInfo_ChannelPage] Channel banner found with selector:', selector);
              break;
          }
      }

      if(channelBanner && channelBanner.src && channelBanner.src.startsWith('http')){
        // Only transform if it's a ggpht URL, banners can be diverse.
        result.thumbnailUrl = transformYouTubeChannelImageUrl(channelBanner.src); // Transformed
        console.log('[CS_ExtractInfo_ChannelPage] Channel banner successfully updated (and transformed if applicable) thumbnailUrl.');
      } else {
        console.log('[CS_ExtractInfo_ChannelPage] Channel banner not found or src invalid, thumbnailUrl remains transformed avatar.');
      }
    } else {
        console.log('[CS_ExtractInfo_ChannelPage] Channel avatar not found.');
        result.debug_cs_channelImgFound = false;
    }
    // Ensure URLs are absolute before sending
    try {
        if (result.faviconUrl && !result.faviconUrl.startsWith('http') && !result.faviconUrl.startsWith('data:') && window.location.origin) { result.faviconUrl = new URL(result.faviconUrl, window.location.origin).href; }
        if (result.thumbnailUrl && !result.thumbnailUrl.startsWith('http') && !result.thumbnailUrl.startsWith('data:') && window.location.origin) { result.thumbnailUrl = new URL(result.thumbnailUrl, window.location.origin).href; }
        if (result.extractedChannelUrl && !result.extractedChannelUrl.startsWith('http') && !result.extractedChannelUrl.startsWith('data:') && window.location.origin) { result.extractedChannelUrl = new URL(result.extractedChannelUrl, window.location.origin).href; }
    } catch (e) {
        console.warn("[CS_ExtractInfo_ChannelPage] Error constructing absolute URL:", e);
    }
    console.log('[CS_ExtractInfo_ChannelPage] P2 Extraction complete. Sending message to background.');
    chrome.runtime.sendMessage({ action: "extractedPageInfo", data: result });
  }
  // Generic Page Branch
  else {
    console.log('[CS_ExtractInfo_GenericPage] Processing as generic page.');
    // Ensure URLs are absolute (if any specific ones were found by initial favicon/OG logic)
    try {
        if (result.faviconUrl && !result.faviconUrl.startsWith('http') && !result.faviconUrl.startsWith('data:') && window.location.origin) { result.faviconUrl = new URL(result.faviconUrl, window.location.origin).href; }
        if (result.thumbnailUrl && !result.thumbnailUrl.startsWith('http') && !result.thumbnailUrl.startsWith('data:') && window.location.origin) { result.thumbnailUrl = new URL(result.thumbnailUrl, window.location.origin).href; }
        // No extractedChannelUrl for generic pages, typically
    } catch (e) {
        console.warn("[CS_ExtractInfo_GenericPage] Error constructing absolute URL:", e);
    }
    console.log('[CS_ExtractInfo_GenericPage] Generic page extraction. Sending message to background.');
    chrome.runtime.sendMessage({ action: "extractedPageInfo", data: result });
  }
  // The final console.log and return result are removed as each branch sends its own message.
}

// Function to parse YouTube video preview element
function parseYouTubeLinkPreview(linkUrl) {
    const details = {
        videoUrl: null,
        videoTitle: null,
        videoThumbnailUrl: null,
        channelUrl: null,
        channelTitle: null,
        channelIconUrl: null 
    };

    if (!linkUrl || !linkUrl.includes("youtube.com/watch")) {
        console.warn("parseYouTubeLinkPreview: linkUrl is not a direct YouTube video link or is missing.", linkUrl);
        return details; 
    }
    details.videoUrl = linkUrl;

    const videoLinkElements = Array.from(document.querySelectorAll(`a[href="${details.videoUrl}"], a[href^="${details.videoUrl.split('&')[0]}"]`)); 
    
    let videoLinkElement = videoLinkElements.find(a => 
        a.id === 'video-title' || 
        a.matches('h3.title-and-badge a.yt-simple-endpoint') || 
        a.closest('ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-video-renderer, ytd-playlist-panel-video-renderer') 
    );
     if (!videoLinkElement && videoLinkElements.length > 0) videoLinkElement = videoLinkElements[0]; 

    if (!videoLinkElement) {
        console.warn("parseYouTubeLinkPreview: Could not find a suitable DOM element for video link:", details.videoUrl);
        if (details.videoUrl) {
            try {
                const url = new URL(details.videoUrl);
                const videoId = url.searchParams.get('v');
                if (videoId) {
                    details.videoThumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                }
                details.videoTitle = document.title; 
            } catch (e) { console.error("Error parsing video URL for fallback details", e); }
        }
        console.log("[CS_ParseLink] Function was called with linkUrl:", linkUrl);
        console.log("[CS_ParseLink] Identified videoUrl for this context:", details.videoUrl);
        console.log("[CS_ParseLink] FINAL details object (no videoLinkElement):", JSON.parse(JSON.stringify(details)));
        return details;
    }

    const previewContainer = videoLinkElement.closest('ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-video-renderer, ytd-playlist-panel-video-renderer, div#dismissible');

    if (previewContainer) {
        const titleElement = previewContainer.querySelector('#video-title, .title-and-badge a h3 .yt-core-attributed-string, #video-title-link yt-formatted-string, #meta h3 yt-formatted-string');
        // Reverted videoTitle logic for parseYouTubeLinkPreview
        if (titleElement && titleElement.textContent) {
            details.videoTitle = titleElement.textContent.trim();
        } else if (videoLinkElement) { // Ensure videoLinkElement exists for these attributes
            details.videoTitle = videoLinkElement.getAttribute('aria-label') || // Prefer aria-label
                                 videoLinkElement.getAttribute('title') || 
                                 videoLinkElement.textContent.trim() || // Then link's own text
                                 "YouTube Video"; // Generic fallback if nothing else
        } else {
             details.videoTitle = "YouTube Video"; // Should not happen if videoLinkElement is guaranteed by outer logic
        }
        console.log("[CS_ParseLink] Extracted videoTitle:", details.videoTitle); // Reverted log message too

        const imgElement = previewContainer.querySelector('yt-image img[src*="ytimg.com/vi/"], img.yt-core-image--loaded[src*="ytimg.com/vi/"]');
        if (imgElement && imgElement.src) {
            details.videoThumbnailUrl = imgElement.src.split('?')[0]; 
        } else { 
             try {
                const url = new URL(details.videoUrl);
                const videoId = url.searchParams.get('v');
                if (videoId) details.videoThumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
             } catch(e) { console.warn("Error parsing videoId for thumbnail fallback", e); }
        }
        console.log("[CS_ParseLink] Extracted videoThumbnailUrl:", details.videoThumbnailUrl); 
        
        // --- START New Channel Info Extraction Logic ---
        details.channelTitle = null; // Reset before trying
        details.channelUrl = null;   // Reset before trying

        console.log("[CS_ParseLink_Chan] Attempting to find channel information within previewContainer:", previewContainer);

        // Attempt 1: Look for common channel name text elements
        const channelNameSelectors = [
            // New selectors for sidebar/compact renderers (prioritized)
            '#byline-container yt-formatted-string.ytd-channel-name', 
            '.ytd-video-meta-block #byline-container yt-formatted-string.ytd-channel-name',
            '#channel-name .ytd-channel-name', // General if yt-formatted-string is nested

            // Existing selectors
            '#channel-name yt-formatted-string.ytd-channel-name', 
            'yt-formatted-string.ytd-channel-name',                 
            '.ytd-video-meta-block #channel-name yt-formatted-string',
            '#byline.ytd-video-meta-block yt-formatted-string',       
            '.ytd-channel-name#text.yt-formatted-string'              
        ];
        for (const selector of channelNameSelectors) {
            const nameEl = previewContainer.querySelector(selector);
            if (nameEl && nameEl.textContent) {
                details.channelTitle = nameEl.textContent.trim();
                console.log(`[CS_ParseLink_Chan] Found channelTitle using selector '${selector}':`, details.channelTitle);
                break;
            }
        }
        if (!details.channelTitle) {
            console.warn("[CS_ParseLink_Chan] Channel title not found using primary selectors.");
        }

        // Attempt 2: Look for common channel link elements
        const channelLinkSelectors = [
            // New selectors for sidebar/compact renderers (prioritized)
            '#byline-container a.yt-simple-endpoint.ytd-video-meta-block[href*="/@"]',
            '#byline-container a.yt-simple-endpoint.ytd-video-meta-block[href*="/channel/"]',
            '.ytd-channel-name a.yt-simple-endpoint[href*="/@"]', 
            '.ytd-channel-name a.yt-simple-endpoint[href*="/channel/"]',

            // Existing selectors
            '#channel-name a.yt-simple-endpoint',                                  
            'ytd-channel-name a.yt-simple-endpoint',                               
            '#avatar-link.yt-simple-endpoint[href*="/@"], #avatar-link.yt-simple-endpoint[href*="/channel/"]', 
            'a.yt-simple-endpoint.ytd-video-meta-block[href*="/@"]',             
            'a.yt-simple-endpoint.ytd-video-meta-block[href*="/channel/"]',      
            '.metadata a.yt-simple-endpoint[href*="/@"]',                         
            '.metadata a.yt-simple-endpoint[href*="/channel/"]'
        ];
        let channelLinkElement = null;
        for (const selector of channelLinkSelectors) {
            const linkEl = previewContainer.querySelector(selector);
            if (linkEl && linkEl.href) {
                details.channelUrl = linkEl.href;
                channelLinkElement = linkEl; // Save for potential title fallback
                console.log(`[CS_ParseLink_Chan] Found channelUrl using selector '${selector}':`, details.channelUrl);
                break;
            }
        }
        
        if (details.channelUrl) {
            // If we found a URL but not a title yet, try to get title from the link's text content or attributes
            if (!details.channelTitle && channelLinkElement) {
                details.channelTitle = channelLinkElement.title || channelLinkElement.textContent.trim().split('\n').find(s => s.trim()) || '';
                console.log("[CS_ParseLink_Chan] Fallback channelTitle from found channelLinkElement text/title:", details.channelTitle);
                if (!details.channelTitle) { // Final fallback from URL if text is empty
                    try {
                        details.channelTitle = new URL(details.channelUrl).pathname.split('/').pop().replace(/^@/, '');
                        console.log("[CS_ParseLink_Chan] Fallback channelTitle from channelUrl pathname:", details.channelTitle);
                    } catch (e) { console.warn("[CS_ParseLink_Chan] Could not parse channelUrl for fallback title", e); }
                }
            }
            // Ensure Channel URL is absolute
            if (details.channelUrl && !details.channelUrl.startsWith('http') && window.location.origin) {
                try {
                    details.channelUrl = new URL(details.channelUrl, window.location.origin).href;
                } catch (e) { console.warn("[CS_ParseLink_Chan] Failed to make channelUrl absolute:", e); details.channelUrl = null; }
            }
        } else {
            console.warn("[CS_ParseLink_Chan] Channel URL not found using any selectors.");
        }
        
        // If title was found but URL wasn't, this is less useful, but log it.
        if (details.channelTitle && !details.channelUrl) {
            console.warn("[CS_ParseLink_Chan] Found channelTitle but NO channelUrl:", details.channelTitle);
        }
        // --- End of new Channel Info Extraction Logic ---
        
        // Attempt to find channel icon within the preview container
        const channelAvatarInPreview = previewContainer.querySelector(
            '#avatar-link yt-img-shadow img, a.yt-simple-endpoint yt-img-shadow#avatar img, .ytd-channel-name yt-img-shadow img'
        );
        if (channelAvatarInPreview && channelAvatarInPreview.src) {
            details.channelIconUrl = transformYouTubeChannelImageUrl(channelAvatarInPreview.src); // Transformed
            console.log("[CS_ParseLink_Chan] Extracted and transformed channelIconUrl from preview:", details.channelIconUrl);
        } else {
            console.warn("[CS_ParseLink_Chan] Could not find channelIconUrl in preview."); 
        }
        // Ensure channelIconUrl is absolute (though src from img tags usually are)
        // The transform function itself doesn't make it absolute, so this existing logic is still useful if transform returns original.
        if (details.channelIconUrl && !details.channelIconUrl.startsWith('http') && !details.channelIconUrl.startsWith('data:') && window.location.origin) {
             try { details.channelIconUrl = new URL(details.channelIconUrl, window.location.origin).href; } catch (e) { console.warn("[CS_ParseLink_Chan] Failed to make channelIconUrl absolute:", e); details.channelIconUrl = null; }
        }

    } else {
        console.warn("[CS_ParseLink] No previewContainer found for linkUrl:", linkUrl);
        details.videoTitle = videoLinkElement.getAttribute('aria-label') || videoLinkElement.getAttribute('title') || document.title;
        if (details.videoUrl) {
            try {
                const url = new URL(details.videoUrl);
                const videoId = url.searchParams.get('v');
                if (videoId) details.videoThumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            } catch(e) { console.warn("Error parsing videoId for thumbnail fallback (no container)", e); }
        }
    }
    
    try {
      if (details.videoThumbnailUrl && !details.videoThumbnailUrl.startsWith('http') && !details.videoThumbnailUrl.startsWith('data:') && window.location.origin) { details.videoThumbnailUrl = new URL(details.videoThumbnailUrl, window.location.origin).href; }
    } catch (e) {
      console.warn("Error constructing absolute URL for preview details (thumbnail):", e);
    }
    
    console.log("[CS_ParseLink] Function was called with linkUrl:", linkUrl);
    console.log("[CS_ParseLink] Identified videoUrl for this context:", details.videoUrl);
    console.log("[CS_ParseLink] FINAL details object:", JSON.parse(JSON.stringify(details))); 
    return details;
}


// Main execution logic for content script
(function() {
  if (chrome.runtime && chrome.runtime.sendMessage) {
      try {
        extractInitialPageInfo(); // Call it, it will handle its own message sending.
        console.log("Content script: extractInitialPageInfo initiated.");
      } catch (e) {
        console.error("Content script: Error initiating page info extraction:", e);
      }
  }

  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log("Content script received message:", request);
      if (request.action === "parseYouTubeLinkPreview" && request.linkUrl) {
        try {
            const parsedDetails = parseYouTubeLinkPreview(request.linkUrl);
            sendResponse({ action: "parsedYouTubeLinkPreviewResults", data: parsedDetails });
        } catch (e) {
            console.error("Error parsing YouTube link preview:", e);
            sendResponse({ action: "parsedYouTubeLinkPreviewResults", error: e.message, data: {} });
        }
        return true; 
      } else if (request.action === "getFaviconForWebsite") { 
        try {
            let faviconResult = { faviconUrl: null };
            const faviconSelectors = [
                "link[rel='icon']", "link[rel='shortcut icon']", 
                "link[rel='apple-touch-icon']", "link[rel='apple-touch-icon-precomposed']"
            ];
            for (let selector of faviconSelectors) { 
                const iconLink = document.querySelector(selector);
                if (iconLink && iconLink.href) { faviconResult.faviconUrl = iconLink.href; break; } 
            }
            if (!faviconResult.faviconUrl && window.location.origin) { 
                try { faviconResult.faviconUrl = new URL('/favicon.ico', window.location.origin).href; } catch(e) { console.warn("Error creating favicon URL:", e); }
            }
            if (faviconResult.faviconUrl && !faviconResult.faviconUrl.startsWith('http') && !faviconResult.faviconUrl.startsWith('data:') && window.location.origin) { 
                try { faviconResult.faviconUrl = new URL(faviconResult.faviconUrl, window.location.origin).href; } catch(e) { console.warn("Error constructing absolute favicon URL:", e); }
            }
            sendResponse({ action: "faviconForWebsiteResults", data: faviconResult });
        } catch (e) {
            console.error("Error getting favicon for website:", e);
            sendResponse({ action: "faviconForWebsiteResults", error: e.message, data: { faviconUrl: null } });
        }
        return true;
      }
      return false; 
    });
    console.log("Content script: Message listener for background requests is active.");
  }
})();
