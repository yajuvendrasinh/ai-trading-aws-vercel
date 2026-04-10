"use server"

import { revalidatePath } from "next/cache"

export async function updateBreezeSession(token: string) {
  try {
    const encodedToken = encodeURIComponent(token.trim())
    console.log(`[SessionUpdate] Sending token (prefix: ${token.slice(0, 5)}...) to backend...`)
    
    const res = await fetch(`${process.env.NEXT_PUBLIC_AWS_IP}/session/update?session_token=${encodedToken}`, {
      method: 'POST',
      headers: { 
        'X-API-Key': process.env.API_SECRET_KEY as string 
      }
    })

    if (!res.ok) {
      const error = await res.text()
      console.error(`[SessionUpdate] Backend returned error: ${res.status} - ${error}`)
      throw new Error(error || 'Failed to update session')
    }

    console.log("[SessionUpdate] Successfully updated session in backend.")
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: any) {
    console.error("[SessionUpdate] Error caught:", error)
    return { success: false, error: error.message }
  }
}

export async function getBreezeLoginUrl() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_AWS_IP}/session/login-url`, {
      headers: { 
        'X-API-Key': process.env.API_SECRET_KEY as string 
      }
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.url
  } catch (error) {
    return null
  }
}

export async function fetchBreezeData(endpoint: string) {
  // Ensure we don't end up with double slashes (e.g. http://localhost:8000//health)
  const baseIP = process.env.NEXT_PUBLIC_AWS_IP?.replace(/\/$/, '') || '';
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${baseIP}/${cleanEndpoint}`;
  
  try {
    console.log(`[FetchBreeze] Requesting: ${url}`);
    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.API_SECRET_KEY as string },
      next: { revalidate: 5 } // Fast revalidation for trading
    })
    
    if (!res.ok) {
      if (res.status === 404) {
        console.error(`[FetchBreeze] 404 ERROR: The endpoint ${url} does not exist. PLEASE RESTART YOUR BACKEND.`);
      } else {
        console.error(`[FetchBreeze] API Error: ${res.status} for ${url}`);
      }
      return null;
    }
    
    const data = await res.json();
    console.log(`[FetchBreeze] Success: Received data from ${url}`);
    return data;
  } catch (error) {
    console.error(`[FetchBreeze] Network Error for ${url}:`, error);
    return null;
  }
}

export async function checkSessionStatus() {
  try {
    const data = await fetchBreezeData('/health')
    return data?.breeze_session === true
  } catch (error) {
    return false
  }
}

export async function deepCheckSession(): Promise<{ active: boolean; reason: string }> {
  try {
    const data = await fetchBreezeData('/session/check')
    return {
      active: data?.active === true,
      reason: data?.reason || 'Unknown'
    }
  } catch (error) {
    return { active: false, reason: 'Backend unreachable' }
  }
}

export async function downloadHistoricalData(params: any) {
  const url = `${process.env.NEXT_PUBLIC_AWS_IP}/data/historical`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": process.env.API_SECRET_KEY as string,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || "API returned an error");
    }

    return await res.json();
  } catch (error: any) {
    console.error("[DownloadHistorical] Error:", error);
    throw error;
  }
}

export async function searchSymbols(query: string, exchange: string) {
  const url = `${process.env.NEXT_PUBLIC_AWS_IP}/data/symbols?query=${encodeURIComponent(query)}&exchange=${exchange}`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": process.env.API_SECRET_KEY as string,
      }
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("[SearchSymbols] Error:", error);
    return [];
  }
}

export async function getHistoricalJobStatus(jobId: string) {
  const url = `${process.env.NEXT_PUBLIC_AWS_IP}/data/status/${jobId}`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-API-Key": process.env.API_SECRET_KEY as string,
      },
      cache: 'no-store'
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`[JobStatus] Error for ${jobId}:`, error);
    return null;
  }
}

export async function postTradingCommand(endpoint: string, params: any = {}) {
  const url = `${process.env.NEXT_PUBLIC_AWS_IP}/${endpoint.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": process.env.API_SECRET_KEY as string,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[TradingCommand] API Error: ${res.status} for ${url}`);
      return { success: false, error };
    }

    const data = await res.json();
    revalidatePath('/dashboard');
    return { success: true, data };
  } catch (error: any) {
    console.error(`[TradingCommand] Error for ${url}:`, error);
    return { success: false, error: error.message };
  }
}

export async function triggerKillSwitch() {
  const result = await postTradingCommand('/order/kill-switch')
  return result
}

export async function fetchMargin() {
  return fetchBreezeData('/portfolio/margin');
}

export async function fetchTradeLogs() {
  const url = `${process.env.NEXT_PUBLIC_AWS_IP}/data/trades`;
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.API_SECRET_KEY as string },
      next: { revalidate: 10 }
    })
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    return [];
  }
}
export async function fetchAgentInsights() {
  return fetchBreezeData('/trading/insights');
}
