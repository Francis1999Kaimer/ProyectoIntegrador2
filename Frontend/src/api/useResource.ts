import { useEffect, useState } from 'react'
import { api } from './http'
export function useResource<T>(path: string | null) {
  const [data,setData] = useState<T | null>(null), [loading,setLoading] = useState(!!path), [error,setError] = useState(''), [revision,setRevision] = useState(0)
  useEffect(()=>{
    const controller = new AbortController(); let alive = true
    setData(null); setError(''); setLoading(!!path)
    if (path) void api.request<T>(path,{signal:controller.signal}).then(value=>{if(alive)setData(value)}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false;controller.abort()}
  },[path,revision])
  return {data,loading,error,reload:()=>setRevision(v=>v+1)}
}
