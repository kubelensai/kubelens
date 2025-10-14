import { useRef, useEffect } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useThemeStore } from '@/stores/themeStore'

interface YamlEditorProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  height?: string
}

export default function YamlEditor({ value, onChange, readOnly = false, height = '500px' }: YamlEditorProps) {
  const { isDark } = useThemeStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor
    
    // Focus editor for immediate interaction
    editor.focus()

    // Configure editor options for better YAML editing
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'all',
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      readOnly: readOnly,
    })
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
    }
  }

  // Update readOnly when prop changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly })
    }
  }, [readOnly])

  return (
    <div 
      className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden"
      style={{ height }}
    >
      <Editor
        height={height}
        defaultLanguage="yaml"
        language="yaml"
        value={value}
        theme={isDark ? 'vs-dark' : 'light'}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          automaticLayout: true,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          tabSize: 2,
          insertSpaces: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        }
      />
    </div>
  )
}

