import React, { Component } from 'react'
import CodeMirror from 'codemirror'
import 'codemirror/mode/meta'

// When Webpack imports these AMD modules for modes, the first one will be set as
// the default mode for CodeMirror, which then analyzes the content accordingly
// under the hood for syntax highlight. However, some mode will report errors if
// the content doesn't comply with its syntax, like dylan which doesn't allow the
// word 'constructor' (though this could be a bug in CodeMirror). Therefore the
// first mode matters. We intentionally select markdown as the first(default) mode
// because of its flexibility in syntax.
import 'codemirror/mode/markdown/markdown'

import 'codemirror/mode/dylan/dylan'
import 'codemirror/mode/textile/textile'
import 'codemirror/mode/pegjs/pegjs'
import 'codemirror/mode/factor/factor'
import 'codemirror/mode/asterisk/asterisk'
import 'codemirror/mode/crystal/crystal'
import 'codemirror/mode/sql/sql'
import 'codemirror/mode/pug/pug'
import 'codemirror/mode/forth/forth'
import 'codemirror/mode/lua/lua'
import 'codemirror/mode/mumps/mumps'
import 'codemirror/mode/elm/elm'
import 'codemirror/mode/tornado/tornado'
import 'codemirror/mode/d/d'
import 'codemirror/mode/rpm/rpm'
import 'codemirror/mode/gfm/gfm'
import 'codemirror/mode/swift/swift'
import 'codemirror/mode/solr/solr'
import 'codemirror/mode/stex/stex'
import 'codemirror/mode/haskell/haskell'
import 'codemirror/mode/velocity/velocity'
import 'codemirror/mode/properties/properties'
import 'codemirror/mode/ruby/ruby'
import 'codemirror/mode/htmlembedded/htmlembedded'
import 'codemirror/mode/smarty/smarty'
import 'codemirror/mode/tiddlywiki/tiddlywiki'
import 'codemirror/mode/go/go'
import 'codemirror/mode/ttcn/ttcn'
import 'codemirror/mode/slim/slim'
import 'codemirror/mode/tiki/tiki'
import 'codemirror/mode/sieve/sieve'
import 'codemirror/mode/troff/troff'
import 'codemirror/mode/z80/z80'
import 'codemirror/mode/eiffel/eiffel'
import 'codemirror/mode/yaml/yaml'
import 'codemirror/mode/powershell/powershell'
import 'codemirror/mode/vhdl/vhdl'
import 'codemirror/mode/turtle/turtle'
import 'codemirror/mode/ebnf/ebnf'
import 'codemirror/mode/livescript/livescript'
import 'codemirror/mode/haml/haml'
import 'codemirror/mode/jinja2/jinja2'
import 'codemirror/mode/php/php'
import 'codemirror/mode/mathematica/mathematica'
import 'codemirror/mode/htmlmixed/htmlmixed'
import 'codemirror/mode/gherkin/gherkin'
import 'codemirror/mode/q/q'
import 'codemirror/mode/ecl/ecl'
import 'codemirror/mode/perl/perl'
import 'codemirror/mode/vue/vue'
import 'codemirror/mode/ntriples/ntriples'
import 'codemirror/mode/cmake/cmake'
import 'codemirror/mode/handlebars/handlebars'
import 'codemirror/mode/modelica/modelica'
import 'codemirror/mode/dockerfile/dockerfile'
import 'codemirror/mode/yaml-frontmatter/yaml-frontmatter'
import 'codemirror/mode/groovy/groovy'
import 'codemirror/mode/oz/oz'
import 'codemirror/mode/twig/twig'
import 'codemirror/mode/pascal/pascal'
import 'codemirror/mode/diff/diff'
import 'codemirror/mode/idl/idl'
import 'codemirror/mode/rst/rst'
import 'codemirror/mode/smalltalk/smalltalk'
import 'codemirror/mode/nsis/nsis'
import 'codemirror/mode/mbox/mbox'
import 'codemirror/mode/spreadsheet/spreadsheet'
import 'codemirror/mode/haskell-literate/haskell-literate'
import 'codemirror/mode/dart/dart'
import 'codemirror/mode/octave/octave'
import 'codemirror/mode/mirc/mirc'
import 'codemirror/mode/haxe/haxe'
import 'codemirror/mode/mllike/mllike'
import 'codemirror/mode/shell/shell'
import 'codemirror/mode/asn.1/asn.1'
import 'codemirror/mode/clike/clike'
import 'codemirror/mode/css/css'
import 'codemirror/mode/pig/pig'
import 'codemirror/mode/xquery/xquery'
import 'codemirror/mode/asciiarmor/asciiarmor'
import 'codemirror/mode/erlang/erlang'
import 'codemirror/mode/scheme/scheme'
import 'codemirror/mode/python/python'
import 'codemirror/mode/coffeescript/coffeescript'
import 'codemirror/mode/clojure/clojure'
import 'codemirror/mode/fcl/fcl'
import 'codemirror/mode/puppet/puppet'
import 'codemirror/mode/brainfuck/brainfuck'
import 'codemirror/mode/http/http'
import 'codemirror/mode/dtd/dtd'
import 'codemirror/mode/r/r'
import 'codemirror/mode/verilog/verilog'
import 'codemirror/mode/xml/xml'
import 'codemirror/mode/javascript/javascript'
import 'codemirror/mode/webidl/webidl'
import 'codemirror/mode/vbscript/vbscript'
import 'codemirror/mode/toml/toml'
import 'codemirror/mode/vb/vb'
import 'codemirror/mode/rust/rust'
import 'codemirror/mode/cypher/cypher'
import 'codemirror/mode/jsx/jsx'
import 'codemirror/mode/django/django'
import 'codemirror/mode/ttcn-cfg/ttcn-cfg'
import 'codemirror/mode/cobol/cobol'
import 'codemirror/mode/commonlisp/commonlisp'
import 'codemirror/mode/soy/soy'
import 'codemirror/mode/stylus/stylus'
import 'codemirror/mode/sparql/sparql'
import 'codemirror/mode/nginx/nginx'
import 'codemirror/mode/sas/sas'
import 'codemirror/mode/mscgen/mscgen'
import 'codemirror/mode/gas/gas'
import 'codemirror/mode/fortran/fortran'
import 'codemirror/mode/apl/apl'
import 'codemirror/mode/julia/julia'
import 'codemirror/mode/tcl/tcl'
import 'codemirror/mode/protobuf/protobuf'
import 'codemirror/mode/yacas/yacas'
import 'codemirror/mode/sass/sass'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/edit/matchtags'
import 'codemirror/addon/dialog/dialog'
import 'codemirror/addon/search/search'
import 'codemirror/addon/search/match-highlighter'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/addon/fold/comment-fold'
import 'codemirror/addon/fold/xml-fold'
import 'codemirror/addon/fold/foldgutter'
import 'codemirror/addon/fold/indent-fold'
import 'codemirror/addon/fold/brace-fold'
import 'codemirror/addon/fold/foldcode'
import 'codemirror/addon/fold/markdown-fold'
import 'codemirror/addon/display/placeholder'

import './index.scss'

import electronBridge from '../../utilities/electronBridge'
import { getEditorTheme } from '../../utilities/themeManager'
import { needsBoundedViewport } from './viewport'

const { createMarkdownImageReference, getFilesFromTransfer } = require('../../utilities/imageAttachments')

const conf = electronBridge.config

const highlightTheme = getEditorTheme(conf.get('theme'))
const configuredEditorOptions = conf.get('editor') || {}
const defaultOptions = Object.assign({}, {
  theme: highlightTheme,
  lineNumbers: true,
  matchBrackets: true,
  matchTags: true,
  lineWrapping: true,
  viewportMargin: Infinity,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
}, configuredEditorOptions)

class CodeMirrorEditor extends Component {
  constructor (props) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
    this.setEditorNode = this.setEditorNode.bind(this)
  }

  componentDidMount () {
    const { options, value } = this.props

    this.codeMirror = CodeMirror(this.editorNode, Object.assign({}, options, {
      value: value || ''
    }))
    this.codeMirror.on('change', this.handleChange)
  }

  componentDidUpdate (prevProps) {
    const { options, value } = this.props

    if (value !== prevProps.value && value !== this.codeMirror.getValue()) {
      this.codeMirror.setValue(value || '')
    }

    Object.keys(options).forEach(key => {
      if (options[key] !== prevProps.options[key]) {
        this.codeMirror.setOption(key, options[key])
      }
    })

    if (this.props.className !== prevProps.className) this.codeMirror.refresh()
  }

  componentWillUnmount () {
    if (!this.codeMirror) return

    this.codeMirror.off('change', this.handleChange)
    const wrapper = this.codeMirror.getWrapperElement()
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper)
    }
    this.codeMirror = null
  }

  setEditorNode (node) {
    this.editorNode = node
  }

  handleChange () {
    if (this.props.onChange) {
      this.props.onChange(this.codeMirror.getValue())
    }
  }

  getCodeMirror () {
    return this.codeMirror
  }

  getCodeMirrorInstance () {
    return CodeMirror
  }

  render () {
    return <div className={ this.props.className } ref={ this.setEditorNode } />
  }
}

class GistEditor extends Component {
  constructor (props) {
    super(props)
    this.handleImageDrop = this.handleImageDrop.bind(this)
    this.handleImagePaste = this.handleImagePaste.bind(this)
  }

  componentDidMount () {
    const { filename } = this.props

    this.CodeMirror = this.editor.getCodeMirrorInstance()
    this.setMode(filename)
    this.editor.getCodeMirror().on('drop', this.handleImageDrop)
    this.editor.getCodeMirror().on('paste', this.handleImagePaste)
  }

  componentDidUpdate (prevProps, prevState) {
    const { filename } = this.props

    if (prevProps.filename !== filename) {
      this.setMode(filename)
    }
  }

  componentWillUnmount () {
    if (!this.editor) return
    const codeMirror = this.editor.getCodeMirror()
    if (!codeMirror) return
    codeMirror.off('drop', this.handleImageDrop)
    codeMirror.off('paste', this.handleImagePaste)
  }

  handleImageDrop (codeMirror, event) {
    const insertionPosition = codeMirror.coordsChar({
      left: event.clientX,
      top: event.clientY
    }, 'window')
    this.handleImageTransfer(codeMirror, event, event.dataTransfer, insertionPosition)
  }

  handleImagePaste (codeMirror, event) {
    this.handleImageTransfer(codeMirror, event, event.clipboardData, null)
  }

  handleImageTransfer (codeMirror, event, transfer, insertionPosition) {
    if (!this.props.onImageFiles) return
    const files = getFilesFromTransfer(transfer, event.type !== 'drop')
    if (!files.length) return

    event.preventDefault()
    event.stopPropagation()
    const insertMarkdown = /\.(md|markdown)$/i.test(this.props.filename || '')

    Promise.resolve(this.props.onImageFiles(files))
      .then(filenames => {
        if (!insertMarkdown || !this.editor || !filenames || !filenames.length) return
        const references = filenames.map(createMarkdownImageReference).join('\n')
        if (insertionPosition) {
          codeMirror.replaceRange(references, insertionPosition)
        } else {
          codeMirror.replaceSelection(references)
        }
      })
      .catch(() => {})
  }

  setMode (filename) {
    const modeInfo = filename ? this.CodeMirror.findModeByFileName(filename) : this.CodeMirror.findModeByName('Plain Text')
    modeInfo && this.editor.getCodeMirror().setOption('mode', modeInfo.mime)
  }

  setEditorRef (editor) {
    this.editor = editor
  }

  render () {
    const { value, placeholder, readOnly } = this.props
    const boundedViewport = needsBoundedViewport(value || '')
    const options = Object.assign({}, defaultOptions, {
      placeholder,
      readOnly: Boolean(readOnly),
      viewportMargin: boundedViewport && configuredEditorOptions.viewportMargin === undefined
        ? 10
        : defaultOptions.viewportMargin
    })

    return (
      <CodeMirrorEditor
        className={ boundedViewport ? 'gist-editor-viewport' : undefined }
        ref={ this.setEditorRef.bind(this) }
        value={ value }
        options={ options }
        onChange={ value => this.props.onChange(value) }
      />
    )
  }
}

export default GistEditor
