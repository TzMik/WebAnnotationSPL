const LanguageUtils = require('../utils/LanguageUtils')
const ColorUtils = require('../utils/ColorUtils')
const Events = require('./Events')

class Tag {
  constructor (config, group = null) {
    this.group = group
    this.name = config.name
    this.namespace = config.namespace
    this.tags = config.tags || [config.namespace + ':' + config.name]
    //
    this.annotation = config.annotation || null
    //
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
  // */,
  index: 'index'
  //
}

module.exports = Tag