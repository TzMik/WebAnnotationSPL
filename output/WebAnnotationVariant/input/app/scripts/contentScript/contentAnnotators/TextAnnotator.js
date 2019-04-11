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
const RolesManager = require('../RolesManager')
//

const ANNOTATION_OBSERVER_INTERVAL_IN_SECONDS = 3
const REMOVE_OVERLAYS_INTERVAL_IN_SECONDS = 3
const ANNOTATIONS_UPDATE_INTERVAL_IN_SECONDS = 60

class TextAnnotator extends ContentAnnotator {
  constructor(config){
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
        Alerts.infoAlert({text: chrome.i18n.getMessage('CurrentSelectionEmpty')})
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
        if (window.abwa.roleManager.role === RolesManager.roles.teacher) {
          //  If a reply already exist show reply, otherwise show comment
          let replies = this.getRepliesForAnnotation(annotation)
          if (replies.length > 0) {
              items['reply'] = {name: 'Reply'}
          } else {
              items['comment'] = {name: 'Comment'}
          }
          items['delete'] = {name: 'Delete annotation'}
        } else if (window.abwa.roleManager.role === RolesManager.roles.student) {
          items['reply'] = {name: 'Reply'}
        }
        //
        return {
          callback: (key) => {
            //
            if (key === 'delete') {
              this.deleteAnnotationHandler(annotation)
            }
            //
            //
          }
        },
        items: items
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
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0 /*
}

module.exports = TextAnnotator