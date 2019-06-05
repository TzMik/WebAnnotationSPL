const ContentAnnotator = require('./ContentAnnotator')
const ContentTypeManager = require('../ContentTypeManager')
const Tag = require('../Tag')
const TagGroup = require('../TagGroup')
const TagManager = require('../TagManager')
const Events = require('../Events')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const _ = require('lodash')
require('components-jqueryui')
const PDFTextUtils = require('../../utils/PDFTextUtils')
const Alerts = require('../../utils/Alerts')
//PVSCL:IFCOND((ReviewMode OR HighlightMode) AND IndexMode, LINE)
const ModeManager = require('../ModeManager')
//PVSCL:ENDCOND
//PVSCL:IFCOND(Student OR Teacher, LINE)
const RolesManager = require('../RolesManager')
//PVSCL:ENDCOND
const Config = require('../../Config')
//let swal = require('sweetalert2')

const ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS = 3
const REMOVE_OVERLAYS_INTERVAL_IN_SECONDS = 3
const ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS = 60

class TextAnnotator extends ContentAnnotator {
  constructor(config){
	super()
    this.events = {}
    this.config = config
    this.observerInterval = null
    this.reloadInterval = null
    this.removeOverlaysInterval = null
    this.currentAnnotations = null
    this.allAnnotations = null
    this.currentUserProfile = null
    this.highlightClassName = 'highlightedAnnotation'
    this.noUsefulHighlightClassName = 'noUsefulHighlightedAnnotation'
    this.lastAnnotation = null
  }

  init(callback){
    console.debug('Initializing TextAnnotator')
    this.initEvents(() => {
      // Retrieve current user profile
      this.currentUserProfile = window.abwa.groupSelector.user
      this.loadAnnotations(() => {
        this.initAnnotatorByAnnotation(() => {
          // Check if something is selected after loading annotations and display sidebar
          if (document.getSelection().toString().length !== 0) {
            if ($(document.getSelection().anchorNode).parents('#abwaSidebarWrapper').toArray().length === 0) {
              this.openSidebar()
            }
          }
          this.initAnnotationsObserver(() => {
            if (_.isFunction(callback)) {
              callback()
            }
          })
        })
      })
    })
  }

  initEvents (callback) {
    this.initSelectionEvents(() => {
      this.initAnnotateEvent(() => {
    	  //PVSCL:IFCOND((ReviewMode OR HighlightMode) AND IndexMode, LINE)
    	  this.initModeChangeEvent(() => {
    	  //PVSCL:ENDCOND
    		  //PVSCL:IFCOND(UserFilter, LINE)
    		  this.initUserFilterChangeEvent(() => {
    		  //PVSCL:ENDCOND
    			  this.initReloadAnnotationsEvent(() => {
    				  //PVSCL:IFCOND(AllDeleter, LINE)
    				  this.initDeleteAllAnnotationsEvent(() => {
    				  //PVSCL:ENDCOND
    					  this.initDocumentURLChangeEvent(() => {
    						  //PVSCL:IFCOND(New, LINE)
    						  this.initTagsUpdatedEvent(() => {
    						  //PVSCL:ENDCOND
    							// Reload annotations periodically
    				                if (_.isFunction(callback)) {
    				                  callback()
    				                }
    						  //PVSCL:IFCOND(New, LINE)
    						  })
    						  //PVSCL:ENDCOND
    					  })
    				  //PVSCL:IFCOND(AllDeleter, LINE)
    				  })
    				  //PVSCL:ENDCOND
    			  })    		  
    		  //PVSCL:IFCOND(UserFilter, LINE)
    		  })
    		  //PVSCL:ENDCOND
    	  //PVSCL:IFCOND((ReviewMode OR HighlightMode) AND IndexMode, LINE)
    	  })
    	  //PVSCL:ENDCOND
      })
    })
    //PVSCL:IFCOND(Spreadsheet, LINE)
    this.initRemoveOverlaysInPDFs()
    //PVSCL:ENDCOND
  }

  initDocumentURLChangeEvent (callback) {
    this.events.documentURLChangeEvent = {element: document, event: Events.updatedDocumentURL, handler: this.createDocumentURLChangeEventHandler()}
    this.events.documentURLChangeEvent.element.addEventListener(this.events.documentURLChangeEvent.event, this.events.documentURLChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }
    
  //PVSCL:IFCOND(AllDeleter, LINE)
  initDeleteAllAnnotationsEvent (callback) {
    this.events.deleteAllAnnotationsEvent = {element: document, event: Events.deleteAllAnnotations, handler: this.createDeleteAllAnnotationsEventHandler()}
    this.events.deleteAllAnnotationsEvent.element.addEventListener(this.events.deleteAllAnnotationsEvent.event, this.events.deleteAllAnnotationsEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createDeleteAllAnnotationsEventHandler (callback) {
    return () => {
      this.deleteAllAnnotations(() => {
          console.debug('All annotations deleted')
      })
    }
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(New, LINE)
  initTagsUpdatedEvent (callback) {
    this.events.tagsUpdated = {element: document, event: Events.tagsUpdated, handler: this.createtagsUpdatedEventHandler()}
    this.events.tagsUpdated.element.addEventListener(this.events.tagsUpdated.event, this.events.tagsUpdated.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }
    
  createtagsUpdatedEventHandler (callback) {
    return () => {
      this.updateAllAnnotations(() => {
        console.debug('Updated all the annotations after Tags Updated event')
      })
    }
  }
  //PVSCL:ENDCOND

  createDocumentURLChangeEventHandler (callback) {
    return () => {
      this.loadAnnotations(() => {
        console.debug('annotations updated')
      })
    }
  }

  initReloadAnnotationsEvent (callback) {
    this.reloadInterval = setInterval(() => {
      this.updateAllAnnotations(() => {
        console.debug('annotations updated')
      })
    }, ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS * 1000)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  //PVSCL:IFCOND(UserFilter, LINE)
  initUserFilterChangeEvent (callback) {
    this.events.userFilterChangeEvent = {element: document, event: Events.userFilterChange, handler: this.createUserFilterChangeEventHandler()}
    this.events.userFilterChangeEvent.element.addEventListener(this.events.userFilterChangeEvent.event, this.events.userFilterChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }
  
  createUserFilterChangeEventHandler () {
    return (event) => {
     // This is only allowed in mode index
      if (window.abwa.modeManager.mode === ModeManager.modes.index) {
        let filteredUsers = event.detail.filteredUsers
        // Unhighlight all annotations
        this.unHighlightAllAnnotations()
        // Retrieve annotations for filtered users
        this.currentAnnotations = this.retrieveAnnotationsForUsers(filteredUsers)
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        this.highlightAnnotations(this.currentAnnotations)
      }
    }
  }
  /**
  * Retrieve from all annotations for the current document, those who user is one of the list in users
  * @param users
  * @returns {Array}
  */
  retrieveAnnotationsForUsers (users) {
    return _.filter(this.allAnnotations, (annotation) => {
      return _.find(users, (user) => {
        return annotation.user === 'acct:' + user + '@hypothes.is'
      })
    })
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND((ReviewMode OR HighlightMode) AND IndexMode, LINE)
  initModeChangeEvent (callback) {
    this.events.modeChangeEvent = {element: document, event: Events.modeChanged, handler: this.createInitModeChangeEventHandler()}
    this.events.modeChangeEvent.element.addEventListener(this.events.modeChangeEvent.event, this.events.modeChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createInitModeChangeEventHandler () {
    return () => {
      //PVSCL:IFCOND((HighlightMode OR ReviewMode) AND IndexMode, LINE)
      if (window.abwa.modeManager.mode === ModeManager.modes.index) {
        // Highlight all annotations
        this.currentAnnotations = this.allAnnotations
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        this.disableSelectionEvent()
      } else {
        // Unhighlight all annotations
        this.unHighlightAllAnnotations()
        // Highlight only annotations from current user
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        // Activate selection event and sidebar functionality
        this.activateSelectionEvent()
      }
      //PVSCL:ENDCOND
      //PVSCL:IFCOND(MarkingMode AND EvidencingMode, LINE)
      // If is mark or view disable the sidebar closing
      if (window.abwa.modeManager.mode === ModeManager.modes.mark || window.abwa.modeManager.mode === ModeManager.modes.view) {
        this.disableSelectionEvent()
      } else {
        this.activateSelectionEvent()
      }
      //PVSCL:ENDCOND
    }
  }
  //PVSCL:ENDCOND

  initAnnotateEvent (callback) {
    this.events.annotateEvent = {element: document, event: Events.annotate, handler: this.createAnnotationEventHandler()}
    this.events.annotateEvent.element.addEventListener(this.events.annotateEvent.event, this.events.annotateEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createAnnotationEventHandler () {
    return (event) => {
      let selectors = []
      // If selection is empty, return null
      if (document.getSelection().toString().length === 0) {
        //PVSCL:IFCOND(Last, LINE)
        // If tag element is not checked, no navigation allowed
        if (event.detail.chosen === 'true'){
          // Navigate to the first annotation for this tag
          this.goToFirstAnnotationOfTag(event.detail.tags[0])
        } else {
          Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionEmpty')})
        }
        //PVSCL:ELSECOND
        Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionEmpty')})
        //PVSCL:ENDCOND
        return
      }
      // If selection is child of sidebar, return null
      if ($(document.getSelection().anchorNode).parents('#annotatorSidebarWrapper').toArray().length !== 0) {
        Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionNotAnnotable')})
        return
      }
      let range = document.getSelection().getRangeAt(0)
      // Create FragmentSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'FragmentSelector' }) !== -1) {
    	//PVSCL:IFCOND(Spreadsheet, LINE)
    	let fragmentSelector = DOMTextUtils.getFragmentSelector(range)
    	//PVSCL:ELSECOND
        let fragmentSelector = null
        if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
          fragmentSelector = PDFTextUtils.getFragmentSelector(range)
        } else {
          fragmentSelector = DOMTextUtils.getFragmentSelector(range)
        }
        //PVSCL:ENDCOND
        if (fragmentSelector) {
          selectors.push(fragmentSelector)
        }
      }
      // Create RangeSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'RangeSelector' }) !== -1) {
        let rangeSelector = DOMTextUtils.getRangeSelector(range)
        if (rangeSelector) {
          selectors.push(rangeSelector)
        }
      }
      // Create TextPositionSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextPositionSelector' }) !== -1) {
        let rootElement = window.abwa.contentTypeManager.getDocumentRootElement()
        let textPositionSelector = DOMTextUtils.getTextPositionSelector(range, rootElement)
        if (textPositionSelector) {
          selectors.push(textPositionSelector)
        }
      }
      // Create TextQuoteSelector
      if (_.findIndex(window.abwa.contentTypeManager.documentType.selectors, (elem) => { return elem === 'TextQuoteSelector' }) !== -1) {
        let textQuoteSelector = DOMTextUtils.getTextQuoteSelector(range)
        if (textQuoteSelector) {
          selectors.push(textQuoteSelector)
        }
      }
      // Construct the annotation to send to hypothesis
      let annotation = TextAnnotator.constructAnnotation(selectors, event.detail.tags)
      window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(annotation, (err, annotation) => {
        if (err) {
          Alerts.errorAlert({text: 'Unexpected error, unable to create annotation'})
        } else {
          // Add to annotations
          //PVSCL:IFCOND(DefaultCriterias, LINE)
          this.allAnnotations.push(annotation)
          //PVSCL:ELSECOND
          this.currentAnnotations.push(annotation)
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          this.allAnnotations.push(annotation)
          //PVSCL:ENDCOND
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
          // Send event annotation is created
          LanguageUtils.dispatchCustomEvent(Events.annotationCreated, {annotation: annotation})
          console.debug('Created annotation with ID: ' + annotation.id)
          this.highlightAnnotation(annotation, () => {
            window.getSelection().removeAllRanges()
          })
        }
      })
    }
  }

  static constructAnnotation(selectors, tags){
    // Check if selectors exist, if then create a target for annotation, in other case the annotation will be a page annotation
    //PVSCL:IFCOND(DefaultCriterias, LINE)
	let target = []
    if (_.isObject(selectors)) {
      target.push({
        selector: selectors
      })
    }
	//PVSCL:ENDCOND
    let data = {
      group: window.abwa.groupSelector.currentGroup.id,
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [],
      tags: tags,
      //PVSCL:IFCOND(DefaultCriterias, LINE)
      target: target,
      //PVSCL:ELSECOND
      target: [{
        selector: selectors
      }],
      //PVSCL:ENDCOND
      text: '',
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let pdfFingerprint = window.abwa.contentTypeManager.pdfFingerprint
      //PVSCL:IFCOND(DefaultCriterias, LINE)
      data.document = {
        documentFingerprint: window.abwa.contentTypeManager.documentFingerprint,
        link: [{
          href: 'urn:x-txt:' + window.abwa.contentTypeManager.documentFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
      //PVSCL:ELSECOND
      data.document = {
        documentFingerprint: pdfFingerprint,
        link: [{
          href: 'urn:x-pdf:' + pdfFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
      //PVSCL:ENDCOND
    }
    // If doi is available, add it to the annotation
    if (!_.isEmpty(window.abwa.contentTypeManager.doi)) {
      data.document = data.document || {}
      let doi = window.abwa.contentTypeManager.doi
      data.document.dc = { identifier: [doi] }
      data.document.highwire = { doi: [doi] }
      data.document.link = data.document.link || []
      data.document.link.push({href: 'doi:' + doi})
    }
    // If citation pdf is found
    if (!_.isEmpty(window.abwa.contentTypeManager.citationPdf)) {
      let pdfUrl = window.abwa.contentTypeManager.doi
      data.document.link = data.document.link || []
      data.document.link.push({href: pdfUrl, type: 'application/pdf'})
    }
    return data
  }

  initSelectionEvents (callback) {
    if (_.isEmpty(window.abwa.annotationBasedInitializer.initAnnotation)) {
      // Create selection event
      this.activateSelectionEvent(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }
    
  activateSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler = {element: document, event: 'mouseup', handler: this.mouseUpOnDocumentHandlerConstructor()}
    this.events.mouseUpOnDocumentHandler.element.addEventListener(this.events.mouseUpOnDocumentHandler.event, this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }
    
  disableSelectionEvent (callback) {
    this.events.mouseUpOnDocumentHandler.element.removeEventListener(
      this.events.mouseUpOnDocumentHandler.event,
      this.events.mouseUpOnDocumentHandler.handler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  /**
   * Initializes annotations observer, to ensure dynamic web pages maintain highlights on the screen
   * @param callback Callback when initialization finishes
   */
  initAnnotationsObserver (callback) {
    this.observerInterval = setInterval(() => {
      console.debug('Observer interval')
      // CreateAnnotationEventHandler funtzioko baldintza berdina
      //PVSCL:IFCOND(DefaultCriterias, LINE)
      // If a swal is displayed, do not execute highlighting observer
      if (document.querySelector('.swal2-container') === null) { // TODO Look for a better solution...
        if (this.allAnnotations) {
          for (let i = 0; i < this.allAnnotations.length; i++) {
            let annotation = this.allAnnotations[i]
            // Search if annotation exist
            let element = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
            // If annotation doesn't exist, try to find it
            if (!_.isElement(element)) {
              Promise.resolve().then(() => { this.highlightAnnotation(annotation) })
            }
          }
        }
      }
      //PVSCL:ELSECOND
      if (this.currentAnnotations) {
        for (let i = 0; i < this.currentAnnotations.length; i++) {
          let annotation = this.currentAnnotations[i]
          // Search if annotation exist
          let element = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
          // If annotation doesn't exist, try to find it
          if (!_.isElement(element)) {
            Promise.resolve().then(() => { this.highlightAnnotation(annotation) })
          }
        }
      }
      //PVSCL:ENDCOND  
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // TODO Improve the way to highlight to avoid this interval (when search in PDFs it is highlighted empty element instead of element)
    this.cleanInterval = setInterval(() => {
      console.debug('Clean interval')
      let highlightedElements = document.querySelectorAll('.highlightedAnnotation')
      highlightedElements.forEach((element) => {
      if (element.innerText === '') {
        $(element).remove()
      }
      })
    }, ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS * 1000)
    // Callback
    if (_.isFunction(callback)) {
      callback()
    }
  }

  loadAnnotations (callback) {
    this.updateAllAnnotations((err) => {
      if (err) {
        // TODO Show user no able to load all annotations
        console.error('Unable to load annotations')
      } else {
        // Current annotations will be
        // CreateAnnotationEventHandler funtzioko baldintza berdina
        //PVSCL:IFCOND(DefaultCriterias, LINE)
        this.allAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        //PVSCL:ELSECOND
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        //PVSCL:ENDCOND
        // Highlight annotations in the DOM
        //PVSCL:IFCOND(Moodle, LINE)
        this.redrawAnnotations()
        //PVSCL:ELSEIFCOND(Spreadsheet, LINE)
        this.highlightAnnotations(this.currentAnnotations)
        //PVSCL:ELSECOND
        this.highlightAnnotations(this.allAnnotations)
        //PVSCL:ENDCOND
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })        
  }

  updateAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        //PVSCL:IFCOND(Replys, LINE)
        // Get reply annotations
        this.replyAnnotations = _.remove(annotations, (annotation) => {
          return annotation.references && annotation.references.length > 0
        })
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(Spreadsheet, LINE)
        // Search tagged annotations
        let tagList = window.abwa.tagManager.getTagsList()
        let taggedAnnotations = []
        for (let i = 0; i < annotations.length; i++) {
        // Check if annotation contains a tag of current group
          let tag = TagManager.retrieveTagForAnnotation(annotations[i], tagList)
          if (tag) {
            taggedAnnotations.push(annotations[i])
          }
        }
        this.allAnnotations = taggedAnnotations || []
        //PVSCL:ELSECOND
        // Search tagged annotations
        let filteringTags = window.abwa.tagManager.getFilteringTagList()
        this.allAnnotations = _.filter(annotations, (annotation) => {
          let tags = annotation.tags
          return !(tags.length > 0 && _.find(filteringTags, tags[0])) || (tags.length > 1 && _.find(filteringTags, tags[1]))
        })
        // Redraw all annotations
        this.redrawAnnotations()
        //PVSCL:ENDCOND
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        if (_.isFunction(callback)) {
          callback(null, this.allAnnotations)
        }
      }
    })
  }

  //PVSCL:IFCOND(Spreadsheet, LINE)
  getAllAnnotations (callback) {
    // Retrieve annotations for current url and group
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      url: window.abwa.contentTypeManager.getDocumentURIToSearchInHypothesis(),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis(),
      group: window.abwa.groupSelector.currentGroup.id,
      order: 'asc'
    }, (err, annotations) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Search tagged annotations
        let tagList = window.abwa.tagManager.getTagsList()
        let taggedAnnotations = []
        for (let i = 0; i < annotations.length; i++) {
          // Check if annotation contains a tag of current group
          let tag = TagManager.retrieveTagForAnnotation(annotations[i], tagList)
          if (tag) {
            taggedAnnotations.push(annotations[i])
          }
        }
        if (_.isFunction(callback)) {
          callback(null, taggedAnnotations)
        }
      }
    })
  }
  //PVSCL:ENDCOND

  retrieveCurrentAnnotations () {
    //PVSCL:IFCOND(IndexMode AND HighlightMode, LINE)
    // Depending on the mode of the tool, we must need only
    if (window.abwa.modeManager.mode === ModeManager.modes.index) {
      return this.allAnnotations
    } else if (window.abwa.modeManager.mode === ModeManager.modes.highlight) {
      // Filter annotations which user is different to current one
      return _.filter(this.allAnnotations, (annotation) => { return annotation.user === this.currentUserProfile.userid })
    }
    //PVSCL:ELSECOND
    return this.allAnnotations
    //PVSCL:ENDCOND
  }

  highlightAnnotations (annotations, callback) {
    let promises = []
    annotations.forEach(annotation => {
      promises.push(new Promise((resolve) => {
        this.highlightAnnotation(annotation, resolve)
      }))
    })
    Promise.all(promises).then(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  highlightAnnotation (annotation, callback) {
    let classNameToHighlight = this.retrieveHighlightClassName(annotation)
    //PVSCL:IFCOND(NOT(Spreadsheet), LINE)
    // Get annotation color for an annotation
    let tagInstance = window.abwa.tagManager.findAnnotationTagInstance(annotation)
    if (tagInstance) {
    	let color = tagInstance.getColor()
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(Spreadsheet, LINE)
    let tagList = window.abwa.tagManager.getTagsList()
    let tagForAnnotation = TagManager.retrieveTagForAnnotation(annotation, tagList)
    //PVSCL:ENDCOND
    try {
    	//PVSCL:IFCOND(Spreadsheet, LINE)
    	let highlightedElements = []
    	 // TODO Remove this case for google drive
        if (window.location.href.includes('drive.google.com')) {
          // Ensure popup exists
          if (document.querySelector('.a-b-r-x')) {
        	  highlightedElements = DOMTextUtils.highlightContent(annotation.target[0].selector, classNameToHighlight, annotation.id)
        //PVSCL:ELSECOND
          let highlightedElements = DOMTextUtils.highlightContent(
            annotation.target[0].selector, classNameToHighlight, annotation.id)
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(Spreadsheet, LINE)
          }
        } else {
           highlightedElements = DOMTextUtils.highlightContent(
           annotation.target[0].selector, classNameToHighlight, annotation.id)
        }
        //PVSCL:ENDCOND
        // Highlight in same color as button
        highlightedElements.forEach(highlightedElement => {
          // If need to highlight, set the color corresponding to, in other case, maintain its original color
          $(highlightedElement).css('background-color',/*PVSCL:IFCOND(Spreadsheet)*/ tagForAnnotation.color /*PVSCL:ELSECOND*/ color /*PVSCL:ENDCOND*/)
          highlightedElement.dataset.color = /*PVSCL:IFCOND(Spreadsheet)*/tagForAnnotation.color/*PVSCL:ELSECOND*/color/*PVSCL:ENDCOND*/
          //PVSCL:IFCOND(Spreadsheet, LINE)
          highlightedElement.dataset.tags = tagForAnnotation.tags
          let user = annotation.user.replace('acct:', '').replace('@hypothes.is', '')
          if (this.config.namespace === Config.exams.namespace) {
            let tagGroup = _.find(window.abwa.tagManager.currentTags, (tagGroup) => { return _.find(tagGroup.tags, tagForAnnotation) })
            let highestMark = _.last(tagGroup.tags).name
            highlightedElement.title = 'Rubric: ' + tagGroup.config.name + '\nMark: ' + tagForAnnotation.name + ' of ' + highestMark
          } else if (this.config.namespace === Config.slrDataExtraction.namespace) {
            highlightedElement.title = 'Author: ' + user + '\n' + 'Category: ' + tagForAnnotation.name
          } else {
            highlightedElement.title = 'Author: ' + user + '\n'
          }
          //PVSCL:ELSECOND
          let group = null
          if (LanguageUtils.isInstanceOf(tagInstance, TagGroup)) {
            group = tagInstance
            // Set message
            //PVSCL:IFCOND(Moodle, LINE)
            highlightedElement.title = 'Rubric competence: ' + group.config.name + '\nMark is pending, go to marking mode.'
            //PVSCL:ELSECOND
            highlightedElement.title = group.config.name + '\nLevel is pending, please right click to set a level.'
            //PVSCL:ENDCOND
          } else if (LanguageUtils.isInstanceOf(tagInstance, Tag)) {
            group = tagInstance.group
            //PVSCL:IFCOND(Moodle, LINE)
            // Get highest mark
            let highestMark = _.last(group.tags).name
            highlightedElement.title = 'Rubric competence: ' + group.config.name + '\nMark: ' + tagInstance.name + ' of ' + highestMark
            //PVSCL:ELSECOND
            highlightedElement.title = group.config.name + '\nLevel: ' + tagInstance.name
            //PVSCL:ENDCOND
          }
          if (!_.isEmpty(annotation.text)) {
        	//PVSCL:IFCOND(DefaultCriterias, LINE)
        	try {
              let feedback = JSON.parse(annotation.text)
              highlightedElement.title += '\nFeedback: ' + feedback.comment
            } catch (e) {
        	//PVSCL:ENDCOND
            highlightedElement.title += '\nFeedback: ' + annotation.text
            //PVSCL:IFCOND(DefaultCriterias, LINE)
            }
            //PVSCL:ENDCOND
          }
          //PVSCL:ENDCOND
        })
        // Create context menu event for highlighted elements
        this.createContextMenuForAnnotation(annotation)
        //PVSCL:IFCOND(IndexMode, LINE)
        this.createNextAnnotationHandler(annotation)
        //PVSCL:ELSECOND
        this.createDoubleClickEventHandler(annotation)
        //PVSCL:ENDCOND
    } catch (e) {
      callback(new Error('Element not found'))
    } finally {
      if (_.isFunction(callback)) {
        callback()
      }
    }
    //PVSCL:IFCOND(NOT(Spreadsheet), LINE)
    }
    //PVSCL:IFCOND(Moodle, LINE)
    else {
        let color = 'rgba(0, 0, 0, 0.5)' // Neutral color for elements to remove
        try {
          // Highlight elements
          let highlightedElements = DOMTextUtils.highlightContent(
            annotation.target[0].selector, this.noUsefulHighlightClassName, annotation.id)
          highlightedElements.forEach(highlightedElement => {
            // If need to highlight, set the color corresponding to, in other case, maintain its original color
            $(highlightedElement).css('background-color', color)
            // Add title
            let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
            let levelName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:mark:')
            let criteriaLevelText = ''
            if (_.isString(levelName)) {
              criteriaLevelText = 'This annotation pertains to the criteria ' + criteriaName + ' with level ' + levelName + ' which is not in your rubric.\n'
            } else {
              criteriaLevelText = 'This annotation pertains to the criteria ' + criteriaName + ' which is not in your rubric.\n'
            }
            highlightedElement.title = criteriaLevelText +
              'Please consider re-marking this assignment (if the criteria exists) or deleting this annotation.'
            // Create context menu event for highlighted elements
            this.createContextMenuForNonUsefulAnnotation(annotation)
          })
        } finally {

        }
    }
    //PVSCL:ENDCOND
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(IndexMode, LINE)
  createNextAnnotationHandler (annotation) {
    let annotationIndex = _.findIndex(
      this.currentAnnotations,
      (currentAnnotation) => { return currentAnnotation.id === annotation.id })
    let nextAnnotationIndex = _.findIndex(
      this.currentAnnotations,
      (currentAnnotation) => { return _.isEqual(currentAnnotation.tags, annotation.tags) },
      annotationIndex + 1)
    // If not next annotation found, retrieve the first one
    if (nextAnnotationIndex === -1) {
      nextAnnotationIndex = _.findIndex(
        this.currentAnnotations,
        (currentAnnotation) => { return _.isEqual(currentAnnotation.tags, annotation.tags) })           
    }
    // If annotation is different, create event
    if (nextAnnotationIndex !== annotationIndex) {
      let highlightedElements = document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')
      for (let i = 0; i < highlightedElements.length; i++) {
        let highlightedElement = highlightedElements[i]
        highlightedElement.addEventListener('click', () => {
          // If mode is index, move to next annotation
          if (window.abwa.modeManager.mode === ModeManager.modes.index) {
            this.goToAnnotation(this.currentAnnotations[nextAnnotationIndex])
          }
        })
      }
    }
  }
  //PVSCL:ELSECOND
  createDoubleClickEventHandler (annotation) {
    let highlights = document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')
    for (let i = 0; i < highlights.length; i++) {
      let highlight = highlights[i]
      highlight.addEventListener('dblclick', () => {
        //PVSCL:IFCOND(Student OR Teacher, LINE)
        if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
          let replies = this.getRepliesForAnnotation(annotation)
          if (replies.length > 0) {
            this.replyAnnotationHandler(annotation)
          } else {
            this.commentAnnotationHandler(annotation)
          }
        } else if (window.abwa.roleManager.role === RolesManager.roles.student) {
          this.replyAnnotationHandler(annotation)
        }
        //PVSCL:ELSECOND
        this.commentAnnotationHandler(annotation)
        //PVSCL:ENDCOND
      })
    }
  }
  //PVSCL:ENDCOND

  createContextMenuForAnnotation (annotation) {
    $.contextMenu({
      selector: '[data-annotation-id="' + annotation.id + '"]',
      build: () => {
        // Create items for context menu
        let items = {}
        // If current user is the same as author, allow to remove annotation
        //PVSCL:IFCOND(Student OR Teacher, LINE)
        if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
          //  If a reply already exist show reply, otherwise show comment
          let replies = this.getRepliesForAnnotation(annotation)
          if (replies.length > 0) {
        	  //PVSCL:IFCOND(Replys, LINE)
              items['reply'] = {name: 'Reply'}
              //PVSCL:ENDCOND
          } else {
        	  //PVSCL:IFCOND(Comments, LINE)
              items['comment'] = {name: 'Comment'}
              //PVSCL:ENDCOND
          }
          items['delete'] = {name: 'Delete annotation'}
        } else if (window.abwa.roleManager.role === RolesManager.roles.student) {
          //PVSCL:IFCOND(Replys, LINE)
          items['reply'] = {name: 'Reply'}
          //PVSCL:ENDCOND
        }
        //PVSCL:ENDCOND
        //PVSCL:IFCOND(Comments, LINE)
        items['comment'] = {name: 'Comment'}
        //PVSCL:ENDCOND
        items['delete'] = {name: 'Delete'}
        if (this.currentUserProfile.userid === annotation.user) {
          items['delete'] = {name: 'Delete annotation'}
        }
        if (this.config.namespace === Config.slrDataExtraction.namespace) {
          if (window.abwa.modeManager.mode === ModeManager.modes.index) {
            if (_.isObject(items['delete'])) {
              items['sep1'] = '---------'
            }
            //PVSCL:IFCOND(Validations)
            items['validate'] = {name: 'Validate classification'}
            //PVSCL:ENDCOND
          }
        }
        return {
          callback: (key) => {
            //PVSCL:IFCOND(Validations, LINE)
            if (key === 'validate') {
              // Validate annotation category
              LanguageUtils.dispatchCustomEvent(Events.annotationValidated, {annotation: annotation})
            }
            //PVSCL:ENDCOND
            if (key === 'delete') {
              this.deleteAnnotationHandler(annotation)
            }
            //PVSCL:IFCOND(Comments, LINE)
            if (key === 'comment') {
              this.commentAnnotationHandler(annotation)
            }
            //PVSCL:ENDCOND
            //PVSCL:IFCOND(Replys, LINE)
            if (key === 'reply') {
              this.replyAnnotationHandler(annotation)
            }
            //PVSCL:ENDCOND
          },
          items: items
        }
      }
    })
  }

  //PVSCL:IFCOND(Replys, LINE)
  replyAnnotationHandler (annotation) {
    // Get annotations replying current annotation
    let repliesData = this.createRepliesData(annotation)
    let inputValue = ''
    if (_.last(repliesData.replies) && _.last(repliesData.replies).user === window.abwa.groupSelector.user.userid) {
        inputValue = _.last(repliesData.replies).text
    }
    Alerts.inputTextAlert({
      input: 'textarea',
      inputPlaceholder: inputValue || 'Type your reply here...',
      inputValue: inputValue || '',
      html: repliesData.htmlText,
      callback: (err, result) => {
        if (err) {
        } else {
          if (_.isEmpty(inputValue)) {
            // The comment you are writing is new
            let replyAnnotationData = TextAnnotator.constructAnnotation()
            // Add text
            replyAnnotationData.text = result
            // Add its reference (the annotation that replies to
            replyAnnotationData.references = [annotation.id]
            window.abwa.hypothesisClientManager.hypothesisClient.createNewAnnotation(replyAnnotationData, (err, replyAnnotation) => {
              if (err) {
                // Show error when creating annotation
                Alerts.errorAlert({text: 'There was an error when replying, please try again. Make sure you are logged in Hypothes.is.'})
              } else {
                // Dispatch event of new reply is created
                LanguageUtils.dispatchCustomEvent(Events.reply, {
                  replyType: 'new',
                  annotation: annotation,
                  replyAnnotation: replyAnnotation
                })
                // Add reply to reply list
                this.replyAnnotations.push(replyAnnotation)
              }
            })
          } else {
              // The comment you are writing is a modification of the latest one
              window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(_.last(repliesData.replies).id, {
              }, (err, replyAnnotation) => {
                if (err) {
                  // Show error when updating annotation
                  Alerts.errorAlert({text: 'There was an error when editing your reply, please try again. Make sure you are logged in Hypothes.is.'})
                } else {
                  // TODO Remove the comment and create the new one in moodle
                  LanguageUtils.dispatchCustomEvent(Events.reply, {
                    replyType: 'update',
                    annotation: annotation,
                    replyAnnotation: replyAnnotation,
                    originalText: inputValue
                  })
                }
              })
          }
          console.log(result)
        }
      }
    })
  }

  createRepliesData (annotation) {
    let htmlText = ''
    // Add feedback comment text
    htmlText += this.createReplyLog(annotation)
    htmlText += '<hr/>'
    // get replies for this annotation
    let replies = this.getRepliesForAnnotation(annotation)
    // What and who
    for (let i = 0; i < replies.length - 1; i++) {
      let reply = replies[i]
      htmlText += this.createReplyLog(reply)
      if (replies.length - 2 > i) {
        htmlText += '<hr/>'
      }
    }
    // If last reply is from current user, don't show it in reply chain, it will be shown as comment to be edited
    let lastReply = _.last(replies)
    if (lastReply) {
      if (lastReply.user !== window.abwa.groupSelector.user.userid) {
        htmlText += '<hr/>'
        htmlText += this.createReplyLog(lastReply)
      }
    }
    return {htmlText: htmlText, replies: replies}
  }

  getRepliesForAnnotation (annotation) {
    let replies = _.filter(this.replyAnnotations, (replyAnnotation) => {
      return AnnotationUtils.isReplyOf(annotation, replyAnnotation)
    })
    replies = _.orderBy(replies, 'updated')
    return replies
  }

  createReplyLog (reply) {
    let htmlText = ''
    // Add user name
    if (reply.user === window.abwa.groupSelector.user.userid) {
      htmlText += '<span class="reply_user">You: </span>'
    } else {
      let username = reply.user.split('acct:')[1].split('@hypothes.is')[0]
      htmlText += '<span class="reply_user">' + username + ': </span>'
    }
    let urlizedReplyText = linkifyUrls(reply.text, {
      attributes: {
        target: '_blank'
      }
    })
    // Add comment
    htmlText += '<span class="reply_text">' + urlizedReplyText + '</span>'
    return htmlText
  }
  //PVSCL:ENDCOND

  deleteAnnotationHandler (annotation) {
    window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(annotation.id, (err, result) => {
      if (err) {
        // Unable to delete this annotation
        console.error('Error while trying to delete annotation %s', annotation.id)
      } else {
        if (!result.deleted) {
          // Alert user error happened
          Alerts.errorAlert({text: chrome.i18n.getMessage('errorDeletingHypothesisAnnotation')})
        } else {
          // Remove annotation from data model
          _.remove(this.currentAnnotations, (currentAnnotation) => {
            return currentAnnotation.id === annotation.id
          })
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          _.remove(this.allAnnotations, (currentAnnotation) => {
            return currentAnnotation.id === annotation.id
          })
          LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
          // Dispatch deleted annotation event
          LanguageUtils.dispatchCustomEvent(Events.annotationDeleted, {annotation: annotation})
          // Unhighlight annotation highlight elements
          DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
          console.debug('Deleted annotation ' + annotation.id)
        } 
      }
    })
  }

  commentAnnotationHandler (annotation) {
    // Close sidebar if opened
    let isSidebarOpened = window.abwa.sidebar.isOpened()
    this.closeSidebar()
    //PVSCL:IFCOND(Moodle AND Comments, LINE)
    // Inputs
    let comment
    // Get annotation criteria
    let criteriaName = AnnotationUtils.getTagSubstringFromAnnotation(annotation, 'exam:isCriteriaOf:')
    // Get previous assignments
    let previousAssignments = this.retrievePreviousAssignments()
    let previousAssignmentsUI = this.createPreviousAssignmentsUI(previousAssignments)
    Alerts.multipleInputAlert({
      title: criteriaName,
      html: previousAssignmentsUI.outerHTML + '<textarea data-minchars="1" data-multiple id="comment" rows="6" autofocus>' + annotation.text + '</textarea>',
      onBeforeOpen: (swalMod) => {
        // Add event listeners for append buttons
        let previousAssignmentAppendElements = document.querySelectorAll('.previousAssignmentAppendButton')
        previousAssignmentAppendElements.forEach((previousAssignmentAppendElement) => {
          previousAssignmentAppendElement.addEventListener('click', () => {
            // Append url to comment
            let commentTextarea = document.querySelector('#comment')
            commentTextarea.value = commentTextarea.value + previousAssignmentAppendElement.dataset.studentUrl
          })
          // Load datalist with previously used texts
          this.retrievePreviouslyUsedComments(criteriaName).then((previousComments) => {
            let awesomeplete = new Awesomplete(document.querySelector('#comment'), {
              list: previousComments,
              minChars: 0
            })
            // On double click on comment, open the awesomeplete
            document.querySelector('#comment').addEventListener('dblclick', () => {
              awesomeplete.evaluate()
              awesomeplete.open()
            })
          })
        })
      },
      // position: Alerts.position.bottom, // TODO Must be check if it is better to show in bottom or not
      preConfirm: () => {
        comment = document.querySelector('#comment').value
      },
      callback: (err, result) => {
        if (!_.isUndefined(comment)) {
          if (err) {
            window.alert('Unable to load alert. Is this an annotable document?')
          } else {
            // Update annotation
            annotation.text = comment || ''
            window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(
              annotation.id,
              annotation,
              (err, annotation) => {
                if (err) {
                  // Show error message
                  Alerts.errorAlert({text: chrome.i18n.getMessage('errorUpdatingAnnotationComment')})
                } else {
                  // Update current annotations
                  let currentIndex = _.findIndex(this.currentAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
                  this.currentAnnotations.splice(currentIndex, 1, annotation)
                  // Update all annotations
                  let allIndex = _.findIndex(this.allAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
                  this.allAnnotations.splice(allIndex, 1, annotation)
                  // Dispatch updated annotations events
                  LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
                  LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
                  LanguageUtils.dispatchCustomEvent(Events.comment, {annotation: annotation})
                  // Redraw annotations
                  DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
                  this.highlightAnnotation(annotation)
                }
              }
            )
            if (isSidebarOpened) {
              this.openSidebar()
            }
          }
        }
      }
    
    //PVSCL:ELSEIFCOND(Comments OR Strengths)
    let that = this
    let updateAnnotation = (textObject) => {
      annotation.text = JSON.stringify(textObject)
      //PVSCL:IFCOND(Strengths, LINE)
      // Assign level to annotation
      //let level = textObject.level || null
      if (level != null) {
        let tagGroup = window.abwa.tagManager.getGroupFromAnnotation(annotation)
        let pole = tagGroup.tags.find((e) => { return e.name === level })
        annotation.tags = pole.tags
      }
      //PVSCL:ENDCOND
      window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(
        annotation.id,
        annotation,
        (err, annotation) => {
          if (err) {
            // Show error message
            Alerts.errorAlert({text: chrome.i18n.getMessage('errorUpdatingAnnotationComment')})
          } else {
            // Update current annotations
            //PVSCL:IFCOND(DefaultCriterias, LINE) //La misma que CreateAnnotationEventHandler
            let currentIndex = _.findIndex(that.allAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            this.allAnnotations.splice(currentIndex, 1, annotation)
            //PVSCL:ELSECOND
            let currentIndex = _.findIndex(this.currentAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            this.currentAnnotations.splice(currentIndex, 1, annotation)
            //PVSCL:ENDCOND
            let allIndex = _.findIndex(this.allAnnotations, (currentAnnotation) => { return annotation.id === currentAnnotation.id })
            this.allAnnotations.splice(allIndex, 1, annotation)
            // Dispatch updated annotations events
            //PVSCL:IFCOND(DefaultCriterias, LINE) //La misma que la de arriba
            LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: that.allAnnotations})
            //PVSCL:ELSECOND
            LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
            LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
            //PVSCL:ENDCOND
            LanguageUtils.dispatchCustomEvent(Events.comment, {annotation: annotation})
            // Redraw annotations
            DOMTextUtils.unHighlightElements([...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')])
            this.highlightAnnotation(annotation)
          }
        })
    }

    //PVSCL:IFCOND(Citations, LINE)
    let suggestedLiteratureHtml = (lit) => {
      let html = ''
      for (let i in lit) {
        html += '<li><a class="removeReference"></a><span title="' + lit[i] + '">' + lit[i] + '</span></li>'
      }
      return html
    }
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(Strengths, LINE)
    let hasLevel = (annotation, level) => {
      return annotation.tags.find((e) => { return e === Config.review.namespace + ':' + Config.review.tags.grouped.subgroup + ':' + level }) != null
    }
    let groupTag = window.abwa.tagManager.getGroupFromAnnotation(annotation)
    let criterionName = groupTag.config.name
    let poles = groupTag.tags.map((e) => { return e.name })
    // let poleChoiceRadio = poles.length>0 ? '<h3>Pole</h3>' : ''
    let poleChoiceRadio = '<div>'
    poles.forEach((e) => {
      poleChoiceRadio += '<input type="radio" name="pole" class="swal2-radio poleRadio" value="' + e + '" '
      if (hasLevel(annotation, e)) poleChoiceRadio += 'checked'
      poleChoiceRadio += '>'
      switch (e) {
        case 'Strength':
          poleChoiceRadio += '<img class="poleImage" width="20" src="' + chrome.extension.getURL('images/strength.png') + '"/>'
          break
        case 'Major weakness':
          poleChoiceRadio += '<img class="poleImage" width="20" src="' + chrome.extension.getURL('images/majorConcern.png') + '"/>'
          break
        case 'Minor weakness':
          poleChoiceRadio += '<img class="poleImage" width="20" src="' + chrome.extension.getURL('images/minorConcern.png') + '"/>'
          break
      }
      poleChoiceRadio += ' <span class="swal2-label" style="margin-right:5%;" title="\'+e+\'">' + e + '</span>'
    })
    poleChoiceRadio += '</div>'
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(Comments, LINE)
    let newComment
	let level
	let textObject = {}
    //PVSCL:IFCOND(Spreadsheet, LINE)
    let criterionName = annotation.tags[1].replace('slr:code:','') || ''
    //PVSCL:ENDCOND
	if (annotation.text !== "") textObject = JSON.parse(annotation.text)
	let comment = textObject.comment || ''
	//PVSCL:IFCOND(Citations, LINE)
	let suggestedLiterature = textObject.suggestedLiterature || ''
	//PVSCL:ENDCOND
	Alerts.multipleInputAlert({
	  title: criterionName,
	  //PVSCL:IFCOND(Strengths, LINE)
	  html: '<h3 class="criterionName">' + criterionName + '</h3>' + poleChoiceRadio + '<textarea id="swal-textarea" class="swal2-textarea" placeholder="Type your feedback here...">'+ comment +'</textarea>'/*PVSCL:IFCOND(Citations)*/ + '<input placeholder="Suggest literature from DBLP" id="swal-input1" class="swal2-input"><ul id="literatureList">' + suggestedLiterature + '</ul>'/*PVSCL:ENDCOND*/,
	  //PVSCL:ELSECOND
	  html: '<h3 class="criterionName">Insert your comment</h3><textarea id="swal-textarea" class="swal2-textarea" placeholder="Type your feedback here...">'+ comment +'</textarea>'/*PVSCL:IFCOND(Citations)*/ + '<input placeholder="Suggest literature from DBLP" id="swal-input1" class="swal2-input"><ul id="literatureList">' + suggestedLiterature + '</ul>'/*PVSCL:ENDCOND*/,
	  //PVSCL:ENDCOND
	  preConfirm: () => {
	    newComment = $('#swal-textarea').val()
	    suggestedLiterature = Array.from($('#literatureList li span')).map((e) => { return $(e).attr('title') })
	    level = $('.poleRadio:checked') != null && $('.poleRadio:checked').length === 1 ? $('.poleRadio:checked')[0].value : null
	  },
	  callback: (err, result) => {
	    updateAnnotation({comment: newComment/*PVSCL:IFCOND(Citations)*/, suggestedLiterature: suggestedLiterature/*PVSCL:ENDCOND*/}/*PVSCL:IFCOND(Strengths)*/, level/*PVSCL:ENDCOND*/)
	    if (isSidebarOpened) {
	      this.openSidebar()
	    }
	  }
	})
	
	$('.poleRadio + img').on('click', function () {
      $(this).prev('.poleRadio').prop('checked', true)
    })
    
    //PVSCL:IFCOND(Citations, LINE)
    $('#swal-input1').autocomplete({
      source: function (request, response) {
        $.ajax({
          url: 'http://dblp.org/search/publ/api',
          data: {
            q: request.term,
            format: 'json',
            h: 5
          },
          success: function (data) {
            response(data.result.hits.hit.map((e) => { return {label: e.info.title + ' (' + e.info.year + ')', value: e.info.title + ' (' + e.info.year + ')', info: e.info} }))
          }
        })
      },
      minLength: 3,
      delay: 500,
      select: function (event, ui) {
        let content = ''
        if (ui.item.info.authors !== null && Array.isArray(ui.item.info.authors.author)) {
          content += ui.item.info.authors.author.join(', ') + ': '
        } else if (ui.item.info.authors !== null) {
          content += ui.item.info.authors.author + ': '
        }
        if (ui.item.info.title !== null) {
          content += ui.item.info.title
        }
        if (ui.item.info.year !== null) {
          content += ' (' + ui.item.info.year + ')'
        }
        let a = document.createElement('a')
        a.className = 'removeReference'
        a.addEventListener('click', function (e) {
          $(e.target).closest('li').remove()
        })
        let li = document.createElement('li')
        $(li).append(a, '<span title="' + content + '">' + content + '</span>')
        $('#literatureList').append(li)
        setTimeout(function () {
          $('#swal-input1').val('')
        }, 10)
      },
      appendTo: '.swal2-container',
      create: function () {
        $('.ui-autocomplete').css('max-width', $('#swal2-content').width())
      }
    })
    //PVSCL:ENDCOND
    //PVSCL:ENDCOND
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(Moodle, LINE)
  createPreviousAssignmentsUI (previousAssignments) {
    let previousAssignmentsContainer = document.createElement('div')
    previousAssignmentsContainer.className = 'previousAssignmentsContainer'
    for (let i = 0; i < previousAssignments.length; i++) {
      let previousAssignment = previousAssignments[i]
      // Create previous assignment element container
      let previousAssignmentElement = document.createElement('span')
      previousAssignmentElement.className = 'previousAssignmentContainer'
      // Create previous assignment link
      let previousAssignmentLinkElement = document.createElement('a')
      previousAssignmentLinkElement.href = previousAssignment.teacherUrl
      previousAssignmentLinkElement.target = '_blank'
      previousAssignmentLinkElement.innerText = previousAssignment.name
      previousAssignmentLinkElement.className = 'previousAssignmentLink'
      previousAssignmentElement.appendChild(previousAssignmentLinkElement)
      // Create previous assignment append img
      let previousAssignmentAppendElement = document.createElement('img')
      previousAssignmentAppendElement.src = chrome.extension.getURL('images/append.png')
      previousAssignmentAppendElement.title = 'Append the assignment URL'
      previousAssignmentAppendElement.className = 'previousAssignmentAppendButton'
      previousAssignmentAppendElement.dataset.studentUrl = previousAssignment.studentUrl
      previousAssignmentElement.appendChild(previousAssignmentAppendElement)
      previousAssignmentsContainer.appendChild(previousAssignmentElement)
    }
    return previousAssignmentsContainer
  }

  retrievePreviousAssignments () {
    return window.abwa.specific.assessmentManager.previousAssignments
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(Replys, LINE)
  async retrievePreviouslyUsedComments (criteria) {
    return new Promise((resolve, reject) => {
      window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotationsSequential({
        tag: 'exam:isCriteriaOf:' + criteria,
        wildcard_uri: (new URL(window.abwa.contentTypeManager.fileMetadata.url)).origin + '/*'
      }, (err, annotations) => {
        if (err) {
          reject(err)
        } else {
          // Get texts from annotations and send them in callback
          resolve(_.uniq(_.reject(_.map(annotations, (annotation) => {
            // Remove other students moodle urls
            let text = annotation.text
            let regex = /\b(?:https?:\/\/)?[^/:]+\/.*?mod\/assign\/view.php\?id=[0-9]+/g
            return text.replace(regex, '')
          }), _.isEmpty)))
        }
      })
      return true
    })
  }
  //PVSCL:ENDCOND


  retrieveHighlightClassName () {
    return this.highlightClassName // TODO Depending on the status of the application
  }

  mouseUpOnDocumentHandlerConstructor () {
    return (event) => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 /*PVSCL:IFCOND(NOT(Spreadsheet))*/  && $(event.target).parents('.swal2-container').toArray().length === 0 /*PVSCL:ENDCOND PVSCL:IFCOND(Canvas)*/ && $(event.target).parents('#canvasContainer').toArray().length === 0/*PVSCL:ENDCOND*/){
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty')
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 /*PVSCL:IFCOND(DefaultCriterias)*/ && event.target.id !== 'context-menu-layer' /*PVSCL:ENDCOND*/) {
          console.debug('Current selection is not child of the annotator sidebar')
          this.closeSidebar()
        }
      }
    }
  }

  goToFirstAnnotationOfTag (/*PVSCL:IFCOND(Spreadsheet)*/params/*PVSCL:ELSECOND*/tag/*PVSCL:ENDCOND*/) {
    //PVSCL:IFCOND(DefaultCriterias, LINE)
    let annotation = _.find(this.allAnnotations, (annotation) => {
      return annotation.tags.includes(tag)
    })
    //PVSCL:ELSECOND
    let annotation = _.find(this.currentAnnotations, (annotation) => {
      //PVSCL:IFCOND(Moodle, LINE)
      return annotation.tags.includes(tag)
      //PVSCL:ELSECOND
      return _.isEqual(annotation.tags, params.tags)
      //PVSCL:ENDCOND
    })
    //PVSCL:ENDCOND
    //PVSCL:IFCOND(DefaultCriterias, LINE)
    if (annotation) {
    //PVSCL:ENDCOND
      this.goToAnnotation(annotation)
    //PVSCL:IFCOND(DefaultCriterias, LINE)
    }
    //PVSCL:ENDCOND
  }

  //PVSCL:IFCOND(Index, LINE)
  goToAnnotationOfTag (tag) {
    let annotations = _.filter(this.currentAnnotations, (annotation) => {
      return annotation.tags.includes(tag)
    })
    if (annotations.length > 0) {
      let index = _.indexOf(annotations, this.lastAnnotation)
      if (index === -1 || index === annotations.length - 1) {
        this.goToAnnotation(annotations[0])
        this.lastAnnotation = annotations[0]
      } else {
        this.goToAnnotation(annotations[index + 1])
        this.lastAnnotation = annotations[index + 1]
      }
    }
  }
  //PVSCL:ENDCOND

  goToAnnotation (annotation) {
    // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let queryTextSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
      if (queryTextSelector && queryTextSelector.exact) {
    	//PVSCL:IFCOND(DefaultCriterias, LINE)
        // Get page for the annotation
        let fragmentSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'FragmentSelector' })
        if (fragmentSelector && fragmentSelector.page) {
          // Check if annotation was found by 'find' command, otherwise go to page
          if (window.PDFViewerApplication.page !== fragmentSelector.page) {
            window.PDFViewerApplication.page = fragmentSelector.page
          }
        }
        //PVSCL:ENDCOND
        window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        // Timeout to remove highlight used by PDF.js
        setTimeout(() => {
          let pdfjsHighlights = document.querySelectorAll('.highlight')
          for (let i = 0; pdfjsHighlights.length; i++) {
            pdfjsHighlights[i].classList.remove('highlight')
          }
        }, 1000)
        //PVSCL:IFCOND(NOT(DefaultCriterias), LINE)
        // Redraw annotations
        this.redrawAnnotations()
        //PVSCL:ENDCOND
      }
    } else { // Else, try to find the annotation by data-annotation-id element attribute
      let firstElementToScroll = document.querySelector('[data-annotation-id="' + annotation.id + '"]')
      if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
        this.initializationTimeout = setTimeout(() => {
          console.debug('Trying to scroll to init annotation in 2 seconds')
          this.initAnnotatorByAnnotation()
        }, 2000)
      } else {
          firstElementToScroll.scrollIntoView({behavior: 'smooth', block: 'center'})
      }
    }
  }

  closeSidebar () {
    super.closeSidebar()
  }
    
  openSidebar () {
    super.openSidebar()
  }

  destroy () {
    // Remove observer interval
    clearInterval(this.observerInterval)
    // Clean interval
    clearInterval(this.cleanInterval)
    // Remove reload interval
    clearInterval(this.reloadInterval)
    // Remove overlays interval
    if (this.removeOverlaysInterval) {
      clearInterval(this.removeOverlaysInterval)
    }
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
  }

  unHighlightAllAnnotations () {
    let highlightedElements = [...document.querySelectorAll('[data-annotation-id]')]
    DOMTextUtils.unHighlightElements(highlightedElements)
  }

  initAnnotatorByAnnotation (callback) {
    // Check if init annotation exists
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let initAnnotation = window.abwa.annotationBasedInitializer.initAnnotation
      //PVSCL:IFCOND(Moodle, LINE)
      // Go to annotation
      this.goToAnnotation(initAnnotation)
      //PVSCL:ELSECOND
      // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
      if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
        let queryTextSelector = _.find(initAnnotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
        if (queryTextSelector && queryTextSelector.exact) {
          window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
          this.removeFindTagsInPDFs()
        }
      } else {
        let firstElementToScroll = document.querySelector('[data-annotation-id="' + initAnnotation.id + '"]')
        if (!_.isElement(firstElementToScroll) && !_.isNumber(this.initializationTimeout)) {
          this.initializationTimeout = setTimeout(() => {
            console.debug('Trying to scroll to init annotation in 2 seconds')
            this.initAnnotatorByAnnotation()
          }, 2000)
        } else {
          if (_.isElement(firstElementToScroll)) {
            firstElementToScroll.scrollIntoView({behavior: 'smooth', block: 'center'})
          } else {
            // Unable to go to the annotation
          }
        }
      }
      //PVSCL:ENDCOND
    }
    if (_.isFunction(callback)) {
        callback()
    }
  }

  initRemoveOverlaysInPDFs () {
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      this.removeOverlaysInterval = setInterval(() => {
        // Remove third party made annotations created overlays periodically
        document.querySelectorAll('section[data-annotation-id]').forEach((elem) => { $(elem).remove() })
      }, REMOVE_OVERLAYS_INTERVAL_IN_SECONDS * 1000)
    }
  }

  removeFindTagsInPDFs () {
    setTimeout(() => {
      // Remove class for middle selected elements in find function of PDF.js
      document.querySelectorAll('.highlight.selected.middle').forEach(elem => {
        $(elem).removeClass('highlight selected middle')
      })
      // Remove wrap for begin and end selected elements in find function of PDF.js
      document.querySelectorAll('.highlight.selected').forEach(elem => {
        if (elem.children.length === 1) {
          $(elem.children[0]).unwrap()
        } else {
          $(document.createTextNode(elem.innerText)).insertAfter(elem)
          $(elem).remove()
        }
      })
    }, 1000)
  }

  //PVSCL:IFCOND(Moodle, LINE)
  /**
   * Giving a list of old tags it changes all the annotations for the current document to the new tags
   * @param annotations
   * @param newTags
   * @param callback Error, Result
   */
  updateTagsForAnnotations (annotations, newTags, callback) {
    let promises = []
    for (let i = 0; i < annotations.length; i++) {
      let oldTagAnnotation = annotations[i]
      promises.push(new Promise((resolve, reject) => {
        oldTagAnnotation.tags = newTags
        window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(oldTagAnnotation.id, oldTagAnnotation, (err, annotation) => {
          if (err) {
            reject(new Error('Unable to update annotation ' + oldTagAnnotation.id))
          } else {
            resolve(annotation)
          }
        })
      }))
    }
    let resultAnnotations = []
    Promise.all(promises).then((result) => {
    // All annotations updated
    resultAnnotations = result
    }).finally((result) => {
      if (_.isFunction(callback)) {
        callback(null, resultAnnotations)
      }
    })
  }
  //PVSCL:ENDCOND

  //PVSCL:IFCOND(DefaultCriterias, LINE)
  /**
   * Giving a list of old tags it changes all the annotations for the current document to the new tags
   * @param oldTags
   * @param newTags
   * @param callback Error, Result
   */
  updateTagsForAllAnnotationsWithTag (oldTags, newTags, callback) {
    // Get all annotations with oldTags
    let oldTagsAnnotations = _.filter(this.allAnnotations, (annotation) => {
      let tags = annotation.tags
      return oldTags.every((oldTag) => {
        return tags.includes(oldTag)
      })
    })
    let promises = []
    for (let i = 0; i < oldTagsAnnotations.length; i++) {
      let oldTagAnnotation = oldTagsAnnotations[i]
      promises.push(new Promise((resolve, reject) => {
        oldTagAnnotation.tags = newTags
        window.abwa.hypothesisClientManager.hypothesisClient.updateAnnotation(oldTagAnnotation.id, oldTagAnnotation, (err, annotation) => {
        if (err) {
          reject(new Error('Unable to update annotation ' + oldTagAnnotation.id))
        } else {
          resolve(annotation)
        }
        })
      }))
    }
    let annotations = []
    Promise.all(promises).then((result) => {
      // All annotations updated
      annotations = result
    }).finally((result) => {
      if (_.isFunction(callback)) {
        callback(null, annotations)
      }
    })
  }
  //PVSCL:ENDCOND

  redrawAnnotations () {
	//PVSCL:IFCOND(DefaultCriterias, LINE)
    // Unhighlight all annotations
    this.unHighlightAllAnnotations()
    // Highlight all annotations
    this.highlightAnnotations(this.allAnnotations)
    //PVSCL:ELSECOND
    // Unhighlight current annotations
    this.unHighlightAllAnnotations()
    // Highlight current annotations
    this.highlightAnnotations(this.currentAnnotations)
    //PVSCL:ENDCOND
  }


  //PVSCL:IFCOND(AllDeleter, LINE)
  deleteAllAnnotations () {
    // Retrieve all the annotations
    let allAnnotations = this.allAnnotations
    // Delete all the annotations
    let promises = []
    for (let i = 0; i < allAnnotations.length; i++) {
      promises.push(new Promise((resolve, reject) => {
        window.abwa.hypothesisClientManager.hypothesisClient.deleteAnnotation(allAnnotations[i].id, (err) => {
        if (err) {
          reject(new Error('Unable to delete annotation id: ' + allAnnotations[i].id))
        } else {
          resolve()
        }
        })
        return true
      }))
    }
    // When all the annotations are deleted
    Promise.all(promises).catch(() => {
      Alerts.errorAlert({text: 'There was an error when trying to delete all the annotations, please reload and try it again.'})
    }).then(() => {
      //PVSCL:IFCOND(AllDeleter AND NOT(DefaultCriterias), LINE)	
      LanguageUtils.dispatchCustomEvent(Events.deletedAllAnnotations, {allAnnotations: this.allAnnotations})
      //PVSCL:ENDCOND
      // Update annotation variables
      this.allAnnotations = []
      //PVSCL:IFCOND(NOT(DefaultCriterias), LINE)
      this.currentAnnotations = []
      //PVSCL:ENDCOND
      // Dispatch event and redraw annotations
      LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
      this.redrawAnnotations()
    })
  }
  //PVSCL:ENDCOND
}

module.exports = TextAnnotator