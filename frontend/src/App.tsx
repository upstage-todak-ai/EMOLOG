import { useState } from 'react'
import './App.css'
import { extractorApi, reportApi, type ExtractorRequest, type ReportRequest } from './api/client'

function App() {
  const [extractorContent, setExtractorContent] = useState('')
  const [extractorResult, setExtractorResult] = useState<any>(null)
  const [extractorLoading, setExtractorLoading] = useState(false)
  
  const [reportEntries, setReportEntries] = useState('')
  const [reportResult, setReportResult] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const handleExtract = async () => {
    if (!extractorContent.trim()) {
      alert('일기 내용을 입력해주세요.')
      return
    }

    setExtractorLoading(true)
    try {
      const request: ExtractorRequest = {
        content: extractorContent,
      }
      const result = await extractorApi.extract(request)
      setExtractorResult(result)
    } catch (error) {
      console.error('Extractor error:', error)
      alert(`추출 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExtractorLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      // JSON 파싱 시도
      const entries = JSON.parse(reportEntries)
      if (!Array.isArray(entries)) {
        alert('일기 항목은 배열 형식이어야 합니다.')
        return
      }

      setReportLoading(true)
      const request: ReportRequest = {
        diary_entries: entries,
      }
      const result = await reportApi.generateWeekly(request)
      setReportResult(result)
    } catch (error) {
      if (error instanceof SyntaxError) {
        alert('JSON 형식이 올바르지 않습니다.')
      } else {
        console.error('Report error:', error)
        alert(`리포트 생성 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>EmoLog API 테스트</h1>
      
      {/* Extractor 섹션 */}
      <section style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>일기 정보 추출 (Extractor)</h2>
        <div style={{ marginBottom: '10px' }}>
          <label>
            일기 내용:
            <textarea
              value={extractorContent}
              onChange={(e) => setExtractorContent(e.target.value)}
              placeholder="예: 아 부장 ㅅㅂ 화나네 회의때깨짐"
              style={{ width: '100%', minHeight: '100px', padding: '8px', marginTop: '8px' }}
            />
          </label>
        </div>
        <button 
          onClick={handleExtract} 
          disabled={extractorLoading}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          {extractorLoading ? '추출 중...' : '추출하기'}
        </button>
        
        {extractorResult && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h3>추출 결과:</h3>
            <pre>{JSON.stringify(extractorResult, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* Report 섹션 */}
      <section style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>주간 리포트 생성 (Report)</h2>
        <div style={{ marginBottom: '10px' }}>
          <label>
            일기 항목 (JSON 배열):
            <textarea
              value={reportEntries}
              onChange={(e) => setReportEntries(e.target.value)}
              placeholder={`예: [
  {"date": "2026-01-08", "content": "아 부장 ㅅㅂ 화나네 회의때깨짐", "topic": "부장회의", "emotion": "빡침"},
  {"date": "2026-01-09", "content": "야식 먹어서 살찌겟네 ㅠ", "topic": "야식", "emotion": "후회"}
]`}
              style={{ width: '100%', minHeight: '200px', padding: '8px', marginTop: '8px', fontFamily: 'monospace' }}
            />
          </label>
        </div>
        <button 
          onClick={handleGenerateReport} 
          disabled={reportLoading}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          {reportLoading ? '생성 중...' : '리포트 생성하기'}
        </button>
        
        {reportResult && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h3>리포트 결과:</h3>
            <div style={{ marginBottom: '10px' }}>
              <strong>기간:</strong> {reportResult.period_start} ~ {reportResult.period_end}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>요약:</strong> {reportResult.summary}
            </div>
            <div>
              <strong>리포트:</strong>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>{reportResult.report}</div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
