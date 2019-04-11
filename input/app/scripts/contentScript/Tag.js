//PVSCL:IFCOND(ModeSelector)
const LanguageUtils = require('../utils/LanguageUtils')
//PVSCL:ENDCOND
const ColorUtils = require('../utils/ColorUtils')

class Tag {
  constructor (config/*PVSCL:IFCOND(AutomaticSelection OR StaticGroupSelector)*/, group = null /*PVSCL:ENDCOND*/) {
    //PVSCL:IFCOND(AutomaticSelection)
    this.group = group
    //PVSCL:ENDCOND
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    //PVSCL:IFCOND(DefaultCriterias)
    this.annotation = config.annotation || null
    //PVSCL:ENDCOND
    if (config.options && config.options.color) {
      if (!ColorUtils.hasAlpha(config.options.color)) {
        this.color = ColorUtils.setAlphaToColor(config.options.color, 0.5) // Set a 0.5 alpha to all colors without alpha
      } else {
        this.color = config.options.color
      }
    } else {
      this.color = ColorUtils.getHashColor(this.name)
    }
    this.options = config.options
  }

  //PVSCL:IFCOND(HighlightMode AND IndexMode)
  createButton () {
    let tagButtonTemplate = document.querySelector('#tagButtonTemplate')
    this.tagButton = $(tagButtonTemplate.content.firstElementChild).clone().get(0)
    this.tagButton.innerText = this.name
    this.tagButton.title = this.name
    for (let key in this.options) {
      this.tagButton.dataset[key] = this.options[key]
    }
    this.tagButton.dataset.tags = this.tags
    this.tagButton.setAttribute('role', 'annotation')
    if (this.color) {
      $(this.tagButton).css('background-color', this.color)
    }
    // Set handler for button
    this.tagButton.addEventListener('click', (event) => {
      if (event.target.getAttribute('role') === Tag.roles.annotation) {
        LanguageUtils.dispatchCustomEvent(Events.annotate, {tags: this.tags})
      } else if (event.target.getAttribute('role') === Tag.roles.index) {
        window.abwa.contentAnnotator.goToFirstAnnotationOfTag({tags: this.tags})
      }
    })
    return this.tagButton
  }
  //PVSCL:ENDCOND

  getColor () {
    return this.color
  }

  static getInstance (tagObject, group) {
    let tag = new Tag({
      name: tagObject.name,
      namespace: tagObject.namespace,
      options: tagObject.options
    })
    tag.group = group
    tag.color = tagObject.color
    tag.tags = tagObject.tags
    return tag
  }
}

Tag.roles = {
    //PVSCL:IFCOND(HighlightMode)
    annotation: 'annotation'/*PVSCL:ENDCOND*//*PVSCL:IFCOND(IndexMode)*/,
    index: 'index'
    //PVSCL:ENDCOND
}

module.exports = Tag