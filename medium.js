'use strict'
const request = require('request')
const syncRequest = require('sync-request')
const cheerio = require('cheerio')

const medium = {
    JSON_HIJACKING_PREFIX: '])}while(1);</x>',

    findDuplicates: function (data) {
        let result = []
        data.forEach(function (element, index) {
            if (data.indexOf(element, index + 1) > -1) {

                if (result.indexOf(element) === -1) {
                    result.push(element)
                }
            }
        })
        return result
    },

    getLayoutClass: function (p) {
        let $class = ''

        if (p.layout) {
            switch (p.layout) {
                case 1:
                    $class = 'class="layout-centered bs-postwidth"'
                    break
                case 3:
                    $class = 'class="layout-larger bs-postwidth"'
                    break
                case 4:
                    $class = 'class="layout-left bs-postwidth"'
                    break
                case 5:
                    $class = 'class="w-100p"'
                    break
            }
        }

        return $class
    },

    parseMarkup: function (p) {
        let value = ''

        if (p.markups.length > 0) {
            let now = 0, start = 0, end = 0
            let italic = null

            commons.util.quickSort(p.markups, 'start')

            let starts = []
            for (let mu of p.markups) {
                starts.push(mu.start)
            }

            let dup = this.findDuplicates(starts)

            for (let mu of p.markups) {
                if (mu.type == 2) {
                    italic = [mu.start, mu.end]
                } else if (dup.indexOf(mu.start) < 0 || mu.type != 1) {
                    start = mu.start
                    end = mu.end
                    value += p.text.slice(now, start)

                    if (mu.type == 1) {
                        value += '<strong>' + p.text.slice(start, end) + '</strong>'
                    }
                    if (mu.type == 3) {
                        if (mu.anchorType == 2) value += p.text.slice(start, end)
                        else value += '<a href="' + mu.href + '" target="_blank">' + p.text.slice(start, end) + '</a>'
                    }
                    now = end
                }
            }
            value += p.text.slice(now)

            if (italic) value = '<i>' + value + '</i>'
        } else {
            value = p.text
        }

        value.replace(/\n/g, '<br />')

        return value
    },

    parseMediaFrame: function (p, postid) {
        let media = syncRequest('GET', 'https://medium.com/media/' + p.iframe.mediaResourceId + '?postId=' + postid + '"').getBody()
        let $ = cheerio.load(media)

        let $html = ''
        let height = (p.iframe.iframeWidth > 710) ? (710 / p.iframe.iframeWidth * p.iframe.iframeHeight) : p.iframe.iframeHeight

        if ($('iframe').attr('src')) {
            $html = '<figure class="divcenter text-center bs-postwidth">'
            $html += '<iframe class="w-100p" src="' + $('iframe').attr('src') + '" height="' + height + '" allowfullscreen frameborder="0"></iframe>'
            $html += (p.text) ? ('<figcaption>' + p.text + '</figcaption>') : ''
            $html += '</figure>'
        }

        return $html
    },

    parseImage: function (p) {
        let $class = this.getLayoutClass(p)
        let $width = (p.metadata.originalWidth) ? p.metadata.originalWidth : '1600'
        let $height = p.metadata.originalHeight

        let $image = '<div ' + $class + '>'
        $image += '<figure class="divcenter text-center"><div class="mb-10">'
        $image += '<img src="https://cdn-images-1.medium.com/max/' + $width + '/' + p.metadata.id + '" alt="'
        $image += (p.text) ? p.text + '" /></div><figurecaption class="text-center">' + this.parseMarkup(p) + '</figurecaption>' : '" /></div>'
        $image += '</figure></div>'

        return $image
    },

    getHtml: function (paragraphs, pid) {
        let self = this
        let $html = '', prevtype

        if (paragraphs && paragraphs.length > 0) {
            for (let p of paragraphs) {
                if (prevtype !== 9 && p.type === 9) {
                    $html += '<ul class="pl-20 fs-20 bs-postwidth">'
                }
                if (prevtype !== 10 && p.type === 10) {
                    $html += '<ol class="pl-20 fs-20 bs-postwidth">'
                }
                if (prevtype === 9 && p.type !== 9) {
                    $html += '</ul>'
                }
                if (prevtype === 10 && p.type !== 10) {
                    $html += '</ol>'
                }

                switch (p.type) {
                    case 1:
                        $html += '<p class="fs-20 fw-400 mt-35 bs-postwidth">' + self.parseMarkup(p) + '</p>'
                        break
                    case 3:
                        if (!prevtype) break
                        else $html += '<h1 class="topmargin nobottommargin bs-postwidth"><strong>' + self.parseMarkup(p) + '</strong></h1>'
                        break
                    case 4:
                        if (p.layout && (p.layout == 6 || p.layout == 7)) {
                            let $width = (p.metadata.originalWidth) ? p.metadata.originalWidth : '1600'
                            $html += (p.layout == 6) ? '<div class="row">' : ''
                            $html += '<figure class="col-md-6 block">'
                            $html += '<img src="https://cdn-images-1.medium.com/max/' + $width + '/' + p.metadata.id + '" width="' + $width + '" />'
                            $html += '</figure>'
                            $html += (p.text) ? '<figurecaption class="divcenter">' + self.parseMarkup(p) + '</figurecaption>' : ''
                            $html += (p.layout == 7) ? '</div>' : ''
                        } else $html += self.parseImage(p)
                        break
                    case 6:
                        $html += '<blockquote class="bs-postwidth">' + self.parseMarkup(p) + '</blockquote>'
                        break
                    // case 8:
                    //     chtml += '<pre>' + parseMarkup(p) + '</pre>'
                    //     break
                    case 9:
                    case 10:
                        $html += '<li>' + self.parseMarkup(p) + '</li>'
                        break
                    case 11:
                        $html += this.parseMediaFrame(p, pid)
                        break
                    case 13:
                        $html += '<h2 class="t700 fs-24 topmargin nobottommargin bs-postwidth">' + self.parseMarkup(p) + '</h2>'
                }

                prevtype = p.type
            }

            return $html
        } else {
            return ''
        }
    },

    getPosts: function (type, callback) {
        let self = this
        let err = null,
            posts = [],
            users = self.user[type]

        try {
            for (let slug of Object.keys(users)) {
                let user = users[slug]
                let medium = JSON.parse(syncRequest('GET', 'https://medium.com/@' + user.username + '/latest?format=json').getBody('utf8').replace(self.JSON_HIJACKING_PREFIX, ''))
                let content = medium.payload.references.Post

                for (let post of Object.keys(content)) {
                    posts.push(content[post])
                }
            }

            posts.sort((a, b) => {
                return b['createdAt'] - a['createdAt']
            })
        } catch (e) {
            err = e
        }

        callback(err, posts)
    },

    getRelatedPosts: function (callback) {
        let self = this

        try {
            request(self.PUBLISHER_URL, (err, resp, body) => {
                let relates = []
                if (!err) {
                    let medium = JSON.parse(body.replace(self.JSON_HIJACKING_PREFIX, ''))
                    let mediumPost = medium.payload.references.Post
                    let pids = Object.keys(mediumPost)

                    for (let i = 0; i < 3; i++) {
                        relates.push(mediumPost[pids[i]])
                    }
                }

                callback(null, relates)
            })
        } catch (e) {
            callback(e, null)
        }
    },
}

module.exports = medium
