'use strict'
const request = require('request')
const syncRequest = require('sync-request')
const cheerio = require('cheerio')

const medium = require('./medium')

let publisher = ''
let slug = ''

let requrl = 'https://medium.com/' + publisher + '/' + slug + '?format=json'

request(requrl, (err, resp, body) => {
    if (err) {
       console.log(err)
    } else {
        let medium = JSON.parse(body.replace(medium.JSON_HIJACKING_PREFIX, ''))

        if (medium.success) {
            let post = medium.payload.value,
                user = medium.payload.references.User[Object.keys(medium.payload.references.User)[0]]

            let $html = medium.getHtml(post.content.bodyModel.paragraphs, post.id)

            let url = 'https://blockstreethq.com/publication/' + req.params.slug
            let preview = {
                'url': url,
                'imageurl': 'https://cdn-images-1.medium.com/max/' + post.virtuals.previewImage.originalWidth + '/' + post.virtuals.previewImage.imageId,
                'width': post.virtuals.previewImage.originalWidth,
                'height': post.virtuals.previewImage.originalHeight,
                'title': post.title,
                'subtitle': post.virtuals.subtitle
            }

            medium.getRelatedPosts((err, relates) => {
                let timestamp = (post.updatedAt) ? new Date(post.updatedAt) : new Date(post.createdAt)
                return {
                    'title': post.title,
                    'author': user,
                    'timestamp': timestamp,
                    'post': $html,
                    'related': (err) ? null : relates,
                    'local': {
                        'preview': (preview) ? preview : null,
                        'breadcrumb': ['publication', post.title]
                    }
                }
            })
        } else {
            console.log('fail to get medium post')
        }
    }
})
