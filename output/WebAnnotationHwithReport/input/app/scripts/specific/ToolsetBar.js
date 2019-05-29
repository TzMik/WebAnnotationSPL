const Toolset = require('../contentScript/Toolset')
const axios = require('axios')
const _ = require('lodash')
const Alerts = require('../utils/Alerts')
const LanguageUtils = require('../utils/LanguageUtils')
const $ = require('jquery')
require('jquery-contextmenu/dist/jquery.contextMenu')
const Config = require('../Config')
const FileSaver = require('file-saver')
const Events = require('../contentScript/Events')

//let swal = require('sweetalert2')

class ToolsetBar extends Toolset{
  init() {
    super.init(() => {
      // Change toolset header name
      this.toolsetHeader.innerText = 'Toolset'
      let toolsetButtonTemplate = document.querySelector('#toolsetButtonTemplate')

      let generatorImageURL = chrome.extension.getURL('/images/generator.png')
      this.generatorImage = $(toolsetButtonTemplate.content.firstElementChild).clone().get(0)
      this.generatorImage.src = generatorImageURL
      this.generatorImage.id = 'reviewGeneratorButton'
      this.generatorImage.title = 'Generate report'
      this.toolsetBody.appendChild(this.generatorImage)
      this.generatorImage.addEventListener('click', () => {
    	  this.generateReview()
      })
      




    })
  }


  generateReview () {
    Alerts.loadingAlert({text: chrome.i18n.getMessage('GeneratingReviewReport')})
    let allAnnotations = window.abwa.contentAnnotator.allAnnotations
    let t = 'TEXT REPORT \n\n'
    for (let i = 0, len = allAnnotations.length; i < len; i++) {
      let facetTag = _.find(allAnnotations[i].tags, (tag) => {
    	return tag.includes(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':')
      })
      if (facetTag) {
    	let facetName = facetTag.replace(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.grouped.relation + ':', '')
        let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
        if (facet.multivalued || facet.monovalued) t += '(Validated) '
      } else {
    	let facetName = facetTag.replace(Config.slrDataExtraction.namespace + ':' + Config.slrDataExtraction.tags.statics.validated, '')
        let facet = _.find(window.abwa.specific.mappingStudyManager.mappingStudy.facets, (facet) => { return facet.name === facetName })
        if (facet) t += '(Validated) '
      }
      t += allAnnotations[i].tags[1].replace('slr:code:', '') + ': ' + allAnnotations[i].target[0].selector[3].exact + '\n\n'
    }
    let blob = new Blob([t], {type: 'text/plain;charset=utf-8'})
    let docTitle = 'Review report'
    FileSaver.saveAs(blob, docTitle+'.txt')
    Alerts.closeAlert()
  }




  parseAnnotations (annotations){
    const criterionTag = Config.review.namespace + ':' + Config.review.tags.grouped.relation + ':'
    const levelTag = Config.review.namespace + ':' + Config.review.tags.grouped.subgroup + ':'
    const majorConcernLevel = 'Major weakness'
    const minorConcernLevel = 'Minor weakness'
    const strengthLevel = 'Strength'
    let r = new Review()

    for (let a in annotations) {
      let criterion = null
      let level = null
      for (let t in annotations[a].tags) {
        if (annotations[a].tags[t].indexOf(criterionTag) != -1) criterion = annotations[a].tags[t].replace(criterionTag, '').trim()
        if (annotations[a].tags[t].indexOf(levelTag) != -1) level = annotations[a].tags[t].replace(levelTag, '').trim()
      }
      //if (criterion == null || level == null) continue
      let textQuoteSelector = null
      let highlightText = '';
      let pageNumber = null
      for (let k in annotations[a].target) {
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' }) != null) {
          textQuoteSelector = annotations[a].target[k].selector.find((e) => { return e.type === 'TextQuoteSelector' })
          highlightText = textQuoteSelector.exact
        }
        if (annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}) != null){
          pageNumber = annotations[a].target[k].selector.find((e) => { return e.type === 'FragmentSelector'}).page
        }
      }
      let annotationText = annotations[a].text!==null&&annotations[a].text!=='' ? JSON.parse(annotations[a].text) : {comment:'',suggestedLiterature:[]}
      let comment = annotationText.comment !== null ? annotationText.comment : null
      let suggestedLiterature = annotationText.suggestedLiterature !== null ? annotationText.suggestedLiterature : []
      r.insertAnnotation(new Annotation(annotations[a].id,criterion,level,highlightText,pageNumber,comment,suggestedLiterature))
    }
    return r
  }

  show () {
    super.show()
  }

  hide () {
    super.hide()
  }
}

module.exports = ToolsetBar