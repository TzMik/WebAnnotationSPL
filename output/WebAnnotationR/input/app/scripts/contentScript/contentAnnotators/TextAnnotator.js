const ContentAnnotator = require('./ContentAnnotator')
const ContentTypeManager = require('../ContentTypeManager')
const Tag = require('../Tag')
const TagGroup = require('../TagGroup')
const Events = require('../Events')
const DOMTextUtils = require('../../utils/DOMTextUtils')
const LanguageUtils = require('../../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const _ = require('lodash')
require('components-jqueryui')
const PDFTextUtils = require('../../utils/PDFTextUtils')
const Alerts = require('../../utils/Alerts')
//
//

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
  }

  initDocumentURLChangeEvent (callback) {
    this.events.documentURLChangeEvent = {element: document, event: Events.updatedDocumentURL, handler: this.createDocumentURLChangeEventHandler()}
    this.events.documentURLChangeEvent.element.addEventListener(this.events.documentURLChangeEvent.event, this.events.documentURLChangeEvent.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }
    
  //
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
  //

  //

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

  //

  //

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
        //
        // If tag element is not checked, no navigation allowed
        if (event.detail.chosen === 'true'){
          // Navigate to the first annotation for this tag
          this.goToFirstAnnotationOfTag(event.detail.tags[0])
        } else {
          Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionEmpty')})
        }
        //
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
        let fragmentSelector = null
        if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
          fragmentSelector = PDFTextUtils.getFragmentSelector(range)
        } else {
          fragmentSelector = DOMTextUtils.getFragmentSelector(range)
        }
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
          //
          this.currentAnnotations.push(annotation)
          LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
          //
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
    let target = []
    if (_.isObject(selectors)) {
      target.push({
        selector: selectors
      })
    }
    let data = {
      group: window.abwa.groupSelector.currentGroup.id,
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [],
      tags: tags,
      target: target,
      text: '',
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    //
    if (!_.isEmpty(window.abwa.contentTypeManager.documentFingerprint)) {
      data.document = {
        documentFingerprint: window.abwa.contentTypeManager.documentFingerprint,
        link: [{
          href: 'urn:x-txt:' + window.abwa.contentTypeManager.documentFingerprint
        }, {
          href: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
        }]
      }
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
      //
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
      //  
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
        //
        this.currentAnnotations = this.retrieveCurrentAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedCurrentAnnotations, {currentAnnotations: this.currentAnnotations})
        //
        // Highlight annotations in the DOM
        //
        this.highlightAnnotations(this.currentAnnotations)
        //
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
        //
        //
        // Search tagged annotations
        let filteringTags = window.abwa.tagManager.getFilteringTagList()
        this.allAnnotations = _.filter(annotations, (annotation) => {
          let tags = annotation.tags
          return !(tags.length > 0 && _.find(filteringTags, tags[0])) || (tags.length > 1 && _.find(filteringTags, tags[1]))
        })
        // Redraw all annotations
        this.redrawAnnotations()
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        //
        LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
        if (_.isFunction(callback)) {
          callback(null, this.allAnnotations)
        }
      }
    })
  }

  //

  retrieveCurrentAnnotations () {
    //
    return this.allAnnotations
    //
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
  }

  //
  createDoubleClickEventHandler (annotation) {
    let highlights = document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')
    for (let i = 0; i < highlights.length; i++) {
      let highlight = highlights[i]
      highlight.addEventListener('dblclick', () => {
        //
        this.commentAnnotationHandler(annotation)
        //
      })
    }
  }
  //

  createContextMenuForAnnotation (annotation) {
    $.contextMenu({
      selector: '[data-annotation-id="' + annotation.id + '"]',
      build: () => {
        // Create items for context menu
        let items = {}
        // If current user is the same as author, allow to remove annotation
        //
        if (this.currentUserProfile.userid === annotation.user) {
          items['delete'] = {name: 'Delete annotation'}
        }
        //
        //
        return {
          callback: (key) => {
            //
            if (key === 'delete') {
              this.deleteAnnotationHandler(annotation)
            }
            //
            //
          },
          items: items
        }
      }
    })
  }

  //

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
          //
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

  //

  retrieveHighlightClassName () {
    return this.highlightClassName // TODO Depending on the status of the application
  }

  mouseUpOnDocumentHandlerConstructor () {
    return (event) => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 /**/  && $(event.target).parents('.swal2-container').toArray().length === 0 /* */ && $(event.target).parents('#canvasContainer').toArray().length === 0/**/){
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty')
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 /**/ && event.target.id !== 'context-menu-layer' /**/) {
          console.debug('Current selection is not child of the annotator sidebar')
          this.closeSidebar()
        }
      }
    }
  }

  goToFirstAnnotationOfTag (params) {
    //
    let annotation = _.find(this.allAnnotations, (annotation) => {
      return annotation.tags.includes(tag)
    })
    //
    if (annotation) {
      this.goToAnnotation(annotation)
    }
  }

  //

  goToAnnotation (annotation) {
    // If document is pdf, the DOM is dynamic, we must scroll to annotation using PDF.js FindController
    if (window.abwa.contentTypeManager.documentType === ContentTypeManager.documentTypes.pdf) {
      let queryTextSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'TextQuoteSelector' })
      if (queryTextSelector && queryTextSelector.exact) {
        // Get page for the annotation
        let fragmentSelector = _.find(annotation.target[0].selector, (selector) => { return selector.type === 'FragmentSelector' })
        if (fragmentSelector && fragmentSelector.page) {
          // Check if annotation was found by 'find' command, otherwise go to page
          if (window.PDFViewerApplication.page !== fragmentSelector.page) {
            window.PDFViewerApplication.page = fragmentSelector.page
          }
        }
        window.PDFViewerApplication.findController.executeCommand('find', {query: queryTextSelector.exact, phraseSearch: true})
        // Timeout to remove highlight used by PDF.js
        setTimeout(() => {
          let pdfjsHighlights = document.querySelectorAll('.highlight')
          for (let i = 0; pdfjsHighlights.length; i++) {
            pdfjsHighlights[i].classList.remove('highlight')
          }
        }, 1000)
        //
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
    //
    let highlightedElements = _.flatten(_.map(
      this.allAnnotations,
      (annotation) => { return [...document.querySelectorAll('[data-annotation-id="' + annotation.id + '"]')] })
    )
    //
    DOMTextUtils.unHighlightElements(highlightedElements)
  }

  initAnnotatorByAnnotation (callback) {
    // Check if init annotation exists
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let initAnnotation = window.abwa.annotationBasedInitializer.initAnnotation
      //
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
      //
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

  //

  //
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
  //

  //

  //
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
      // Update annotation variables
      this.allAnnotations = []
      // Dispatch event and redraw annotations
      LanguageUtils.dispatchCustomEvent(Events.updatedAllAnnotations, {annotations: this.allAnnotations})
      this.redrawAnnotations()
    })
  }
  //
}

module.exports = TextAnnotator